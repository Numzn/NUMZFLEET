import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize, { UserNotification, NotificationDelivery, NotificationDeliveryAttempt } from '../../models/index.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { DELIVERY_STATUS } from './deliveryStates.js';
import { createDeliveriesForNotification, recordAttempt } from './deliveryRepository.js';
import { applyProviderEvent } from './deliveryLifecycleService.js';

let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const COMPANY = '00000000-0000-0000-0000-000000000001';
const createdNotificationIds = [];

/**
 * A delivery already at SENT, with a real attempt row carrying a provider +
 * providerMessageId — created directly at SENT (not driven through PENDING
 * -> PROCESSING -> SENT) so this never becomes claimable by the live
 * background worker in this dev container even for an instant. That claim
 * path is Phase 3's own concern, already covered by its own tests; this file
 * only needs "a delivery that has already been sent", as a starting point.
 */
async function makeSentSmsDelivery({ provider = 'numz-sms-gateway', providerMessageId = randomUUID() } = {}) {
  const n = await UserNotification.create({
    userId: 900001, type: 'test.lifecycle-service', category: 'system', severity: 'info', urgency: 'normal',
    title: 'T', message: 'M', source: 'fuel-api', metadata: {}, read: false, archived: false,
    tenantId: COMPANY, clientDedupKey: `lifecycle-service-${randomUUID()}`,
  });
  createdNotificationIds.push(n.id);
  const [delivery] = await createDeliveriesForNotification({
    notificationId: n.id, companyId: COMPANY, recipientUserId: 900001, channels: [CHANNELS.SMS], status: DELIVERY_STATUS.SENT,
  });
  const attempt = await recordAttempt({
    delivery, attemptNumber: 1, status: DELIVERY_STATUS.SENT, provider, providerMessageId,
  });
  return { notification: n, delivery, attempt };
}

after(async () => {
  if (!dbReachable) return;
  await UserNotification.destroy({ where: { id: createdNotificationIds } });
});

describe('deliveryLifecycleService.applyProviderEvent', { skip: !dbReachable }, () => {
  it('provider confirms delivery: SENT -> DELIVERED, applied', async () => {
    const { delivery, attempt } = await makeSentSmsDelivery();
    const result = await applyProviderEvent({
      provider: 'numz-sms-gateway', providerMessageId: attempt.providerMessageId, status: DELIVERY_STATUS.DELIVERED, failureCode: null, failureReason: null, occurredAt: new Date(),
    });
    assert.equal(result.outcome, 'applied');
    assert.equal(result.fromStatus, DELIVERY_STATUS.SENT);
    assert.equal(result.toStatus, DELIVERY_STATUS.DELIVERED);

    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.DELIVERED);
    assert.ok(reloaded.deliveredAt);
  });

  it('provider permanent failure: SENT -> FAILED with the normalized reason recorded', async () => {
    const { delivery, attempt } = await makeSentSmsDelivery();
    const result = await applyProviderEvent({
      provider: 'numz-sms-gateway', providerMessageId: attempt.providerMessageId, status: DELIVERY_STATUS.FAILED, failureCode: 'provider_failed', failureReason: 'Network error', occurredAt: new Date(),
    });
    assert.equal(result.outcome, 'applied');
    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.FAILED);
    assert.equal(reloaded.failureCode, 'provider_failed');
    assert.equal(reloaded.failureReason, 'Network error');
    assert.ok(reloaded.failedAt);

    const reloadedAttempt = await NotificationDeliveryAttempt.findByPk(attempt.id);
    assert.equal(reloadedAttempt.status, DELIVERY_STATUS.FAILED);
    assert.equal(reloadedAttempt.failureCode, 'provider_failed');
  });

  it('duplicate callback: applying the same status twice has no duplicate effect', async () => {
    const { delivery, attempt } = await makeSentSmsDelivery();
    const event = {
      provider: 'numz-sms-gateway', providerMessageId: attempt.providerMessageId, status: DELIVERY_STATUS.DELIVERED, failureCode: null, failureReason: null, occurredAt: new Date(),
    };
    const first = await applyProviderEvent(event);
    const second = await applyProviderEvent(event);
    assert.equal(first.outcome, 'applied');
    assert.equal(second.outcome, 'duplicate');

    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.DELIVERED);
    // Exactly one attempt row still — the duplicate callback did not create
    // a second physical send record.
    const attemptCount = await NotificationDeliveryAttempt.count({ where: { deliveryId: delivery.id } });
    assert.equal(attemptCount, 1);
  });

  it('out-of-order callback cannot regress a newer terminal state', async () => {
    const { delivery, attempt } = await makeSentSmsDelivery();
    // The delivery already reached DELIVERED (e.g. a prompt webhook)...
    await applyProviderEvent({
      provider: 'numz-sms-gateway', providerMessageId: attempt.providerMessageId, status: DELIVERY_STATUS.DELIVERED, failureCode: null, failureReason: null, occurredAt: new Date(),
    });
    // ...then a stale/delayed duplicate "failed" event for the SAME message
    // arrives late (e.g. redelivered by the gateway's own retry policy after
    // network trouble on our end delayed the first ack).
    const result = await applyProviderEvent({
      provider: 'numz-sms-gateway', providerMessageId: attempt.providerMessageId, status: DELIVERY_STATUS.FAILED, failureCode: 'provider_failed', failureReason: 'stale', occurredAt: new Date(Date.now() - 60000),
    });
    assert.equal(result.outcome, 'ignored_stale_transition');

    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.DELIVERED, 'must not have regressed to failed');
    assert.equal(reloaded.failureCode, null, 'the stale failure must not have overwritten the real outcome');
  });

  it('an unknown provider message id is handled safely, not thrown', async () => {
    const result = await applyProviderEvent({
      provider: 'numz-sms-gateway', providerMessageId: randomUUID(), status: DELIVERY_STATUS.DELIVERED, failureCode: null, failureReason: null, occurredAt: new Date(),
    });
    assert.equal(result.outcome, 'unknown_delivery');
  });

  it('the same provider message id under a DIFFERENT provider does not match — provider identity is part of the key', async () => {
    const { attempt } = await makeSentSmsDelivery();
    const result = await applyProviderEvent({
      provider: 'smtp', providerMessageId: attempt.providerMessageId, status: DELIVERY_STATUS.DELIVERED, failureCode: null, failureReason: null, occurredAt: new Date(),
    });
    assert.equal(result.outcome, 'unknown_delivery');
  });

  it('tenant isolation: the resolved companyId always comes from the correlated attempt, never guessed', async () => {
    const { delivery, attempt } = await makeSentSmsDelivery();
    const result = await applyProviderEvent({
      provider: 'numz-sms-gateway', providerMessageId: attempt.providerMessageId, status: DELIVERY_STATUS.DELIVERED, failureCode: null, failureReason: null, occurredAt: new Date(),
    });
    assert.equal(result.companyId, delivery.companyId);
  });
});
