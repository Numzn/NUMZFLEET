import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize, {
  UserNotification,
  NotificationDelivery,
  NotificationDeliveryAttempt,
  Company,
} from '../../models/index.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { DELIVERY_STATUS } from './deliveryStates.js';
import {
  createDeliveriesForNotification as createDeliveriesRaw,
  recordAttempt,
  transitionDelivery,
  markAttempted,
  listDeliveriesForNotification,
  listAttemptsForDelivery,
  findAttemptByProviderMessage,
} from './deliveryRepository.js';

// node --test runs multiple test FILES concurrently by default. This file
// tests the repository directly and never claims anything itself, but a row
// left with nextAttemptAt=NULL is immediately due for ANY concurrent claimer
// — the real background worker in this dev container, or a sibling test
// file's own worker tests (deliveryWorker.test.js et al). Both would mutate
// status/attemptCount out from under these tests. Every file that touches
// delivery rows parks them in its own distant, non-overlapping future band;
// this file's is +10h. This file never claims, so it needs only one constant,
// not a paired "claim now" clock the way the worker-driving files do.
const PARK_AT = new Date(Date.now() + 10 * 60 * 60 * 1000);

async function createDeliveriesForNotification(spec) {
  const created = await createDeliveriesRaw(spec);
  if (!created.length) return created;
  await NotificationDelivery.update(
    { nextAttemptAt: PARK_AT },
    { where: { id: created.map((d) => d.id) } },
  );
  // Same ordering as the real function, so callers that destructure by
  // position (e.g. `const [push] = await createDeliveriesForNotification(...)`)
  // see identical behavior to the unwrapped version.
  return NotificationDelivery.findAll({
    where: { id: created.map((d) => d.id) },
    order: [['channel', 'ASC']],
  });
}

// These exercise real Postgres, not mocks — the point of Phase 2 is that the
// rows survive, and only the database can prove the constraints hold.
//
// Reachability is resolved at module load with top-level await, NOT inside
// before(): node:test evaluates a suite's `skip` option when the suite is
// defined, and treats any function as truthy — so a lazy `skip: () => !ready`
// would silently skip everything, always.
let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const COMPANY_A = randomUUID();
const COMPANY_B = randomUUID();
const createdNotificationIds = [];

async function makeNotification(companyId, userId, dedupSuffix) {
  const row = await UserNotification.create({
    userId,
    type: 'test.delivery',
    category: 'system',
    severity: 'info',
    urgency: 'normal',
    title: 'T',
    message: 'M',
    source: 'fuel-api',
    metadata: {},
    read: false,
    archived: false,
    tenantId: companyId,
    clientDedupKey: `${userId}:test-delivery:${dedupSuffix}`,
  });
  createdNotificationIds.push(row.id);
  return row;
}

before(async () => {
  if (!dbReachable) return;
  // Two real companies so tenant isolation is tested against the actual FK.
  await Company.bulkCreate(
    [
      { id: COMPANY_A, name: 'Delivery Test Co A', slug: `delivery-test-a-${COMPANY_A.slice(0, 8)}` },
      { id: COMPANY_B, name: 'Delivery Test Co B', slug: `delivery-test-b-${COMPANY_B.slice(0, 8)}` },
    ],
    { ignoreDuplicates: true },
  );
});

after(async () => {
  if (!dbReachable) return;
  // notification_deliveries and _attempts cascade from notifications.
  await UserNotification.destroy({ where: { id: createdNotificationIds } });
  await Company.destroy({ where: { id: [COMPANY_A, COMPANY_B] } });
});

describe('delivery persistence', { skip: !dbReachable }, () => {
  it('creates one logical delivery per selected channel', async () => {
    const n = await makeNotification(COMPANY_A, 9001, 'multi-channel');
    const deliveries = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9001,
      channels: [CHANNELS.INBOX, CHANNELS.PUSH, CHANNELS.SMS, CHANNELS.EMAIL],
    });

    assert.equal(deliveries.length, 4);
    assert.deepEqual(
      deliveries.map((d) => d.channel).sort(),
      ['email', 'inbox', 'push', 'sms'],
    );
    for (const d of deliveries) {
      assert.equal(d.status, DELIVERY_STATUS.PENDING);
      assert.equal(d.companyId, COMPANY_A, 'tenant must be stamped on every delivery');
      assert.equal(d.recipientUserId, 9001);
      assert.ok(d.queuedAt, 'a pending delivery is queued');
    }
  });

  it('creates independent deliveries for multiple recipients of the same event', async () => {
    const a = await makeNotification(COMPANY_A, 9101, 'recipients');
    const b = await makeNotification(COMPANY_A, 9102, 'recipients');

    for (const [row, userId] of [[a, 9101], [b, 9102]]) {
      await createDeliveriesForNotification({
        notificationId: row.id,
        companyId: COMPANY_A,
        recipientUserId: userId,
        channels: [CHANNELS.INBOX, CHANNELS.SMS],
      });
    }

    const aDeliveries = await listDeliveriesForNotification(a.id, COMPANY_A);
    const bDeliveries = await listDeliveriesForNotification(b.id, COMPANY_A);
    assert.equal(aDeliveries.length, 2);
    assert.equal(bDeliveries.length, 2);
    assert.equal(aDeliveries[0].recipientUserId, 9101);
    assert.equal(bDeliveries[0].recipientUserId, 9102);
  });

  it('is idempotent: re-recording the same notification/channel does not duplicate the delivery', async () => {
    const n = await makeNotification(COMPANY_A, 9201, 'dedup');
    const first = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9201,
      channels: [CHANNELS.INBOX, CHANNELS.SMS],
    });
    const second = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9201,
      channels: [CHANNELS.INBOX, CHANNELS.SMS],
    });

    assert.equal(first.length, 2);
    assert.equal(second.length, 2);
    const count = await NotificationDelivery.count({ where: { notificationId: n.id } });
    assert.equal(count, 2, 'UNIQUE(notification_id, channel) must hold');
    // Identity is stable across repeated processing.
    assert.deepEqual(first.map((d) => d.id).sort(), second.map((d) => d.id).sort());
  });

  it('represents multi-device push as ONE delivery with one attempt per device', async () => {
    const n = await makeNotification(COMPANY_A, 9301, 'push-devices');
    const [push] = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9301,
      channels: [CHANNELS.PUSH],
    });

    const devices = [randomUUID(), randomUUID(), randomUUID()];
    let attemptNumber = 0;
    for (const deviceId of devices) {
      attemptNumber += 1;
      await recordAttempt({
        delivery: push,
        targetType: 'push_subscription',
        targetId: deviceId,
        attemptNumber,
        status: DELIVERY_STATUS.SENT,
        provider: 'web-push',
      });
    }

    const attempts = await listAttemptsForDelivery(push.id, COMPANY_A);
    assert.equal(attempts.length, 3, 'three devices => three attempts');
    assert.deepEqual(attempts.map((a) => a.targetId).sort(), [...devices].sort());

    // The point of the design: still exactly one logical delivery, and exactly
    // one notification — three devices did not become three notifications.
    const deliveryCount = await NotificationDelivery.count({ where: { notificationId: n.id } });
    assert.equal(deliveryCount, 1);
  });

  it('rejects a duplicate attempt via the deterministic idempotency key', async () => {
    const n = await makeNotification(COMPANY_A, 9401, 'attempt-idem');
    const [sms] = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9401,
      channels: [CHANNELS.SMS],
    });

    const first = await recordAttempt({
      delivery: sms, attemptNumber: 1, status: DELIVERY_STATUS.SENT, provider: 'numz-sms-gateway',
    });
    const replay = await recordAttempt({
      delivery: sms, attemptNumber: 1, status: DELIVERY_STATUS.SENT, provider: 'numz-sms-gateway',
    });

    assert.equal(first.id, replay.id, 'replaying an attempt must return the original row');
    const count = await NotificationDeliveryAttempt.count({ where: { deliveryId: sms.id } });
    assert.equal(count, 1, 'a replayed attempt must not create a second physical send record');
  });

  it('persists provider correlation and retrieves it by provider message id', async () => {
    const n = await makeNotification(COMPANY_A, 9501, 'provider');
    const [email] = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9501,
      channels: [CHANNELS.EMAIL],
    });

    const messageId = `<${randomUUID()}@numzfleet.test>`;
    await recordAttempt({
      delivery: email,
      attemptNumber: 1,
      status: DELIVERY_STATUS.SENT,
      provider: 'smtp',
      providerMessageId: messageId,
    });

    const found = await findAttemptByProviderMessage('smtp', messageId, COMPANY_A);
    assert.ok(found, 'a provider callback must be able to find its attempt');
    assert.equal(found.deliveryId, email.id);
    assert.equal(found.provider, 'smtp');
  });

  it('persists failure code, reason and attempt metadata', async () => {
    const n = await makeNotification(COMPANY_A, 9601, 'failure');
    const [sms] = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9601,
      channels: [CHANNELS.SMS],
    });

    await markAttempted(sms);
    await recordAttempt({
      delivery: sms,
      attemptNumber: 1,
      status: DELIVERY_STATUS.FAILED,
      provider: 'numz-sms-gateway',
      failureCode: 'invalid_phone_number',
      failureReason: 'Recipient number failed validation',
    });
    await transitionDelivery(sms, DELIVERY_STATUS.FAILED, {
      failureCode: 'invalid_phone_number',
      failureReason: 'Recipient number failed validation',
    });

    const reloaded = await NotificationDelivery.findByPk(sms.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.FAILED);
    assert.equal(reloaded.failureCode, 'invalid_phone_number');
    assert.equal(reloaded.attemptCount, 1);
    assert.ok(reloaded.lastAttemptAt);
    assert.ok(reloaded.failedAt);

    const [attempt] = await listAttemptsForDelivery(sms.id, COMPANY_A);
    assert.equal(attempt.failureCode, 'invalid_phone_number');
    assert.equal(attempt.failureReason, 'Recipient number failed validation');
  });

  it('refuses an invalid state transition at the repository boundary', async () => {
    const n = await makeNotification(COMPANY_A, 9701, 'transition');
    const [inbox] = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9701,
      channels: [CHANNELS.INBOX],
    });

    await transitionDelivery(inbox, DELIVERY_STATUS.DELIVERED);
    await assert.rejects(
      () => transitionDelivery(inbox, DELIVERY_STATUS.PENDING),
      (e) => e.statusCode === 409,
    );

    const reloaded = await NotificationDelivery.findByPk(inbox.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.DELIVERED, 'state must not have moved');
  });
});

describe('delivery tenant isolation', { skip: !dbReachable }, () => {
  it('company B cannot read company A deliveries or attempts', async () => {
    const n = await makeNotification(COMPANY_A, 9801, 'tenant');
    const [delivery] = await createDeliveriesForNotification({
      notificationId: n.id,
      companyId: COMPANY_A,
      recipientUserId: 9801,
      channels: [CHANNELS.SMS],
    });
    const messageId = `msg-${randomUUID()}`;
    await recordAttempt({
      delivery, attemptNumber: 1, status: DELIVERY_STATUS.SENT,
      provider: 'numz-sms-gateway', providerMessageId: messageId,
    });

    // Same queries, wrong tenant — every one must come back empty.
    assert.deepEqual(await listDeliveriesForNotification(n.id, COMPANY_B), []);
    assert.deepEqual(await listAttemptsForDelivery(delivery.id, COMPANY_B), []);
    assert.equal(await findAttemptByProviderMessage('numz-sms-gateway', messageId, COMPANY_B), null);

    // ...and the correct tenant still sees them, so the test proves scoping
    // rather than an unrelated empty result.
    assert.equal((await listDeliveriesForNotification(n.id, COMPANY_A)).length, 1);
    assert.ok(await findAttemptByProviderMessage('numz-sms-gateway', messageId, COMPANY_A));
  });

  it('every read requires an explicit tenant — none of them silently scan all companies', async () => {
    await assert.rejects(() => listDeliveriesForNotification(randomUUID(), null));
    await assert.rejects(() => listAttemptsForDelivery(randomUUID(), null));
    await assert.rejects(() => findAttemptByProviderMessage('smtp', 'x', null));
  });

  it('a delivery cannot be created without a tenant', async () => {
    await assert.rejects(() => createDeliveriesForNotification({
      notificationId: randomUUID(),
      companyId: null,
      recipientUserId: 1,
      channels: [CHANNELS.SMS],
    }));
  });
});
