import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize, { UserNotification, NotificationDelivery } from '../models/index.js';
import { CHANNELS } from '../notifications/contracts/notificationContract.js';
import { DELIVERY_STATUS } from '../notifications/delivery/deliveryStates.js';
import { createDeliveriesForNotification, recordAttempt } from '../notifications/delivery/deliveryRepository.js';
import { ingestSmsGatewayWebhook } from './smsGatewayWebhookController.js';

let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const COMPANY = '00000000-0000-0000-0000-000000000001';
const createdNotificationIds = [];

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

async function makeSentSmsDelivery() {
  const providerMessageId = randomUUID();
  const n = await UserNotification.create({
    userId: 900001, type: 'test.webhook-controller', category: 'system', severity: 'info', urgency: 'normal',
    title: 'T', message: 'M', source: 'fuel-api', metadata: {}, read: false, archived: false,
    tenantId: COMPANY, clientDedupKey: `webhook-controller-${randomUUID()}`,
  });
  createdNotificationIds.push(n.id);
  const [delivery] = await createDeliveriesForNotification({
    notificationId: n.id, companyId: COMPANY, recipientUserId: 900001, channels: [CHANNELS.SMS], status: DELIVERY_STATUS.SENT,
  });
  await recordAttempt({
    delivery, attemptNumber: 1, status: DELIVERY_STATUS.SENT, provider: 'numz-sms-gateway', providerMessageId,
  });
  return { delivery, providerMessageId };
}

after(async () => {
  if (!dbReachable) return;
  await UserNotification.destroy({ where: { id: createdNotificationIds } });
});

describe('ingestSmsGatewayWebhook', { skip: !dbReachable }, () => {
  it('a valid sms:delivered event is applied and reported', async () => {
    const { delivery, providerMessageId } = await makeSentSmsDelivery();
    const req = {
      body: {
        event: 'sms:delivered',
        payload: { messageId: providerMessageId, deliveredAt: new Date().toISOString() },
      },
    };
    const res = mockRes();
    await ingestSmsGatewayWebhook(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.handled, true);
    assert.equal(res.body.outcome, 'applied');

    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.DELIVERED);
  });

  it('a malformed body is rejected with 400, not a crash', async () => {
    const res = mockRes();
    await ingestSmsGatewayWebhook({ body: null }, res);
    assert.equal(res.statusCode, 400);
  });

  it('a well-formed but unhandled event type 2xx\'s so the gateway does not retry forever', async () => {
    const res = mockRes();
    await ingestSmsGatewayWebhook({ body: { event: 'sms:received', payload: { messageId: 'x' } } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.handled, false);
  });

  it('an event for a message id we have no record of is safely acknowledged, not an error', async () => {
    const res = mockRes();
    await ingestSmsGatewayWebhook({
      body: { event: 'sms:delivered', payload: { messageId: randomUUID(), deliveredAt: new Date().toISOString() } },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.outcome, 'unknown_delivery');
  });

  it('the same event applied twice (gateway retry) is harmless both times', async () => {
    const { providerMessageId } = await makeSentSmsDelivery();
    const body = { event: 'sms:delivered', payload: { messageId: providerMessageId, deliveredAt: new Date().toISOString() } };

    const res1 = mockRes();
    await ingestSmsGatewayWebhook({ body }, res1);
    const res2 = mockRes();
    await ingestSmsGatewayWebhook({ body }, res2);

    assert.equal(res1.statusCode, 200);
    assert.equal(res2.statusCode, 200);
    assert.equal(res1.body.outcome, 'applied');
    assert.equal(res2.body.outcome, 'duplicate');
  });
});
