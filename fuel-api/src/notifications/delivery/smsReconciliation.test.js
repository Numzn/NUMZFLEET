import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize, { UserNotification, NotificationDelivery } from '../../models/index.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { DELIVERY_STATUS } from './deliveryStates.js';
import { createDeliveriesForNotification, recordAttempt } from './deliveryRepository.js';
import { reconcileStaleSmsDeliveries } from './smsReconciliation.js';

let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const COMPANY = '00000000-0000-0000-0000-000000000001';

/**
 * A SENT SMS delivery whose sentAt is backdated by `ageMs`, with a real
 * attempt row. This function's own query has no per-test scoping mechanism
 * (production genuinely wants to scan the whole table) — so unlike most
 * fixture helpers in this codebase, each test here deletes its own
 * notification immediately after its own assertions (see cleanup() below)
 * rather than accumulating until a single after() hook. A test that
 * deliberately leaves a delivery at SENT (the "still in flight" case) would
 * otherwise leak into every later test's own candidate pool for the rest of
 * this file's run.
 */
async function makeStaleSentSms(ageMs) {
  const providerMessageId = randomUUID();
  const n = await UserNotification.create({
    userId: 900001, type: 'test.reconciliation', category: 'system', severity: 'info', urgency: 'normal',
    title: 'T', message: 'M', source: 'fuel-api', metadata: {}, read: false, archived: false,
    tenantId: COMPANY, clientDedupKey: `reconciliation-${randomUUID()}`,
  });
  const [delivery] = await createDeliveriesForNotification({
    notificationId: n.id, companyId: COMPANY, recipientUserId: 900001, channels: [CHANNELS.SMS], status: DELIVERY_STATUS.SENT,
  });
  await recordAttempt({
    delivery, attemptNumber: 1, status: DELIVERY_STATUS.SENT, provider: 'numz-sms-gateway', providerMessageId,
  });
  await delivery.update({ sentAt: new Date(Date.now() - ageMs) });
  return { notificationId: n.id, delivery: await delivery.reload(), providerMessageId };
}

async function cleanup(...notificationIds) {
  await UserNotification.destroy({ where: { id: notificationIds } });
}

describe('reconcileStaleSmsDeliveries', { skip: !dbReachable }, () => {
  it('a delivery stuck at SENT past the threshold is looked up and updated to DELIVERED', async () => {
    const { notificationId, delivery, providerMessageId } = await makeStaleSentSms(20 * 60 * 1000); // 20 min old
    try {
      const summary = await reconcileStaleSmsDeliveries({
        staleAfterMs: 15 * 60 * 1000,
        getStatus: async (id) => {
          assert.equal(id, providerMessageId);
          return { state: 'Delivered', states: { Delivered: new Date().toISOString() } };
        },
      });
      assert.equal(summary.checked, 1);
      assert.equal(summary.applied, 1);

      const reloaded = await NotificationDelivery.findByPk(delivery.id);
      assert.equal(reloaded.status, DELIVERY_STATUS.DELIVERED);
    } finally {
      await cleanup(notificationId);
    }
  });

  it('a delivery not yet past the staleness threshold is left alone', async () => {
    const { notificationId, delivery } = await makeStaleSentSms(1000); // 1s old, well under any real threshold
    try {
      let called = false;
      const summary = await reconcileStaleSmsDeliveries({
        staleAfterMs: 15 * 60 * 1000,
        getStatus: async () => { called = true; return { state: 'Delivered' }; },
      });
      assert.equal(called, false, 'must not even look up a delivery that is not stale yet');
      assert.equal(summary.checked, 0);

      const reloaded = await NotificationDelivery.findByPk(delivery.id);
      assert.equal(reloaded.status, DELIVERY_STATUS.SENT, 'unchanged');
    } finally {
      await cleanup(notificationId);
    }
  });

  it('a still-in-flight provider state (Pending/Processed) changes nothing and is counted separately', async () => {
    const { notificationId } = await makeStaleSentSms(20 * 60 * 1000);
    try {
      const summary = await reconcileStaleSmsDeliveries({
        staleAfterMs: 15 * 60 * 1000,
        getStatus: async () => ({ state: 'Pending' }),
      });
      assert.equal(summary.checked, 1);
      assert.equal(summary.applied, 0);
      assert.equal(summary.stillInFlight, 1);
    } finally {
      await cleanup(notificationId);
    }
  });

  it('one gateway error does not stop the rest of the batch', async () => {
    const stale1 = await makeStaleSentSms(20 * 60 * 1000);
    const stale2 = await makeStaleSentSms(21 * 60 * 1000);
    try {
      const summary = await reconcileStaleSmsDeliveries({
        staleAfterMs: 15 * 60 * 1000,
        getStatus: async (id) => {
          if (id === stale1.providerMessageId) throw new Error('simulated gateway timeout');
          return { state: 'Delivered', states: { Delivered: new Date().toISOString() } };
        },
      });
      assert.equal(summary.checked, 2);
      assert.equal(summary.errors, 1);
      assert.equal(summary.applied, 1);

      const reloaded2 = await NotificationDelivery.findByPk(stale2.delivery.id);
      assert.equal(reloaded2.status, DELIVERY_STATUS.DELIVERED, 'the second delivery must still have been processed');
    } finally {
      await cleanup(stale1.notificationId, stale2.notificationId);
    }
  });

  it('respects the limit — a bounded sweep, not unbounded polling', async () => {
    const fixtures = await Promise.all([
      makeStaleSentSms(20 * 60 * 1000),
      makeStaleSentSms(20 * 60 * 1000),
      makeStaleSentSms(20 * 60 * 1000),
    ]);
    try {
      const summary = await reconcileStaleSmsDeliveries({
        staleAfterMs: 15 * 60 * 1000,
        limit: 2,
        getStatus: async () => ({ state: 'Delivered', states: { Delivered: new Date().toISOString() } }),
      });
      assert.ok(summary.checked <= 2, `expected at most 2 checked, got ${summary.checked}`);
    } finally {
      await cleanup(...fixtures.map((f) => f.notificationId));
    }
  });
});
