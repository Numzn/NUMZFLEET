import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize, { UserNotification, NotificationDelivery, Company } from '../../models/index.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { DELIVERY_STATUS } from './deliveryStates.js';
import { recordPlannedDeliveries } from './deliveryRecorder.js';

// Real Postgres — this proves the actual rows recordPlannedDeliveries writes,
// not just its own in-memory grouping.
let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const COMPANY = '00000000-0000-0000-0000-000000000001';
const createdNotificationIds = [];

// A far-future band, not "now": every 'deliver'-decision row this file
// creates would otherwise have nextAttemptAt=NULL — unconditionally due for
// the real live background worker in this dev container the instant it
// commits (see deliveryWorker.test.js's ROOT CAUSE note for the full
// mechanism). This file tests recordPlannedDeliveries' own translation of a
// plan into rows, not claim behavior, so every row it creates that stays
// non-terminal is parked here rather than left claimable.
const FAR_FUTURE = new Date(Date.now() + 50 * 60 * 60 * 1000);

async function makeNotification() {
  const n = await UserNotification.create({
    userId: 900001, type: 'test.recorder', category: 'system', severity: 'info', urgency: 'normal',
    title: 'T', message: 'M', source: 'fuel-api', metadata: {}, read: false, archived: false,
    tenantId: COMPANY, clientDedupKey: `recorder-${randomUUID()}`,
  });
  createdNotificationIds.push(n.id);
  return n;
}

after(async () => {
  if (!dbReachable) return;
  await UserNotification.destroy({ where: { id: createdNotificationIds } });
});

describe('recordPlannedDeliveries', { skip: !dbReachable }, () => {
  it('a "deliver" decision creates a PENDING row with no failure code', async () => {
    const n = await makeNotification();
    const [row] = await recordPlannedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001,
      plan: [{ channel: CHANNELS.INBOX, decision: 'deliver', overrideNote: null }],
    });
    assert.equal(row.status, DELIVERY_STATUS.PENDING);
    assert.equal(row.failureCode, null);
    assert.equal(row.nextAttemptAt, null);
  });

  it('a "suppress" decision creates a CANCELLED row carrying the exact reason as failure_code, with elaborating text', async () => {
    const n = await makeNotification();
    const [row] = await recordPlannedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001,
      plan: [{ channel: CHANNELS.SMS, decision: 'suppress', reason: 'no_recipient_phone' }],
    });
    assert.equal(row.status, DELIVERY_STATUS.CANCELLED);
    assert.equal(row.failureCode, 'no_recipient_phone');
    assert.ok(row.failureReason && row.failureReason.length > 0, 'a human-readable elaboration must accompany the code');
  });

  it('an unrecognized reason still records the code verbatim rather than dropping it', async () => {
    const n = await makeNotification();
    const [row] = await recordPlannedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001,
      plan: [{ channel: CHANNELS.EMAIL, decision: 'suppress', reason: 'some_future_reason_not_yet_in_the_text_table' }],
    });
    assert.equal(row.failureCode, 'some_future_reason_not_yet_in_the_text_table');
  });

  it('a "delay" decision creates a PENDING row with the given next_attempt_at and reason — parked atomically, never NULL first', async () => {
    const n = await makeNotification();
    const [row] = await recordPlannedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001,
      plan: [{
        channel: CHANNELS.PUSH, decision: 'delay', reason: 'quiet_hours_delayed', nextAttemptAt: FAR_FUTURE,
      }],
    });
    assert.equal(row.status, DELIVERY_STATUS.PENDING);
    assert.equal(row.failureCode, 'quiet_hours_delayed');
    assert.equal(row.nextAttemptAt.getTime(), FAR_FUTURE.getTime());
  });

  it('a mandatory override on a "deliver" decision is recorded as failure_reason with no failure_code (nothing failed)', async () => {
    const n = await makeNotification();
    const [row] = await recordPlannedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001,
      plan: [{
        channel: CHANNELS.SMS, decision: 'deliver', overrideNote: 'mandatory_override:preference_disabled',
      }],
    });
    assert.equal(row.status, DELIVERY_STATUS.PENDING);
    assert.equal(row.failureCode, null);
    assert.equal(row.failureReason, 'mandatory_override:preference_disabled');
  });

  it('multiple channels with different outcomes in one call produce one correctly-shaped row per channel', async () => {
    const n = await makeNotification();
    const rows = await recordPlannedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001,
      plan: [
        { channel: CHANNELS.INBOX, decision: 'deliver', overrideNote: null },
        { channel: CHANNELS.SMS, decision: 'suppress', reason: 'preference_disabled' },
        { channel: CHANNELS.EMAIL, decision: 'suppress', reason: 'no_recipient_email' },
        { channel: CHANNELS.PUSH, decision: 'delay', reason: 'quiet_hours_delayed', nextAttemptAt: FAR_FUTURE },
      ],
    });
    const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r]));
    assert.equal(rows.length, 4);
    assert.equal(byChannel[CHANNELS.INBOX].status, DELIVERY_STATUS.PENDING);
    assert.equal(byChannel[CHANNELS.SMS].status, DELIVERY_STATUS.CANCELLED);
    assert.equal(byChannel[CHANNELS.SMS].failureCode, 'preference_disabled');
    assert.equal(byChannel[CHANNELS.EMAIL].failureCode, 'no_recipient_email');
    assert.equal(byChannel[CHANNELS.PUSH].nextAttemptAt.getTime(), FAR_FUTURE.getTime());
  });

  it('duplicate planning for the same notification+channel does not create a duplicate logical delivery', async () => {
    const n = await makeNotification();
    await recordPlannedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001,
      plan: [{ channel: CHANNELS.PUSH, decision: 'delay', reason: 'quiet_hours_delayed', nextAttemptAt: FAR_FUTURE }],
    });
    // Re-planning the SAME notification (e.g. a retried/duplicated publish
    // call) must not create a second row for the same (notification, channel)
    // — UNIQUE(notification_id, channel) + ignoreDuplicates, unchanged from
    // Phase 2, still holds through the planner's richer plan shape.
    await recordPlannedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001,
      plan: [{ channel: CHANNELS.PUSH, decision: 'delay', reason: 'quiet_hours_delayed', nextAttemptAt: FAR_FUTURE }],
    });
    const count = await NotificationDelivery.count({ where: { notificationId: n.id, channel: CHANNELS.PUSH } });
    assert.equal(count, 1);
  });
});
