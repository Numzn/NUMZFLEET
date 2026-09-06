import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize, { UserNotification } from '../../models/index.js';
import {
  findEscalationCandidates,
  escalateNotification,
  escalateOverdueNotifications,
} from './notificationEscalationService.js';

let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const COMPANY = '00000000-0000-0000-0000-000000000001';
const TEST_USER = 900003;

/**
 * A notification fixture with `createdAt` backdated by `ageMs`. Unlike
 * sentAt/viewedAt elsewhere in this codebase's fixtures, createdAt is a
 * Sequelize-managed timestamp column: instance.update({ createdAt }) is
 * silently dropped from the SET clause (confirmed by direct test — the row's
 * real createdAt never changes), so it must be passed at create() time
 * instead, which Sequelize does respect.
 *
 * This file has no shared after() cleanup: findEscalationCandidates() scans
 * the whole table with no per-test scoping, so a fixture left behind (e.g.
 * the "not yet stale" one) would otherwise leak into a later test's own
 * candidate count — same reasoning as smsReconciliation.test.js.
 */
async function makeCandidate({
  ageMs,
  mandatory = true,
  urgency = 'immediate',
  acknowledgedAt = null,
  escalatedAt = null,
} = {}) {
  return UserNotification.create({
    userId: TEST_USER,
    type: 'test.escalation',
    category: 'system',
    severity: 'critical',
    urgency,
    title: 'Something needs attention',
    message: 'Please check this now',
    source: 'fuel-api',
    // smsTo override: escalateNotification always requests every channel
    // including sms, and channelEligibility.js checks metadata.smsTo before
    // falling back to a real Traccar phone-number lookup for this
    // (nonexistent, test-only) traccarUserId — without this, escalating
    // reaches into real Traccar MySQL for a user that isn't there.
    metadata: { vehicleId: 42, smsTo: '+260977123456' },
    read: false,
    archived: false,
    mandatory,
    acknowledgedAt,
    escalatedAt,
    tenantId: COMPANY,
    clientDedupKey: `escalation-fixture-${randomUUID()}`,
    createdAt: new Date(Date.now() - ageMs),
  });
}

async function findReminderFor(original) {
  return UserNotification.findOne({
    where: { userId: original.userId, clientDedupKey: `${original.userId}:escalation:${original.id}` },
  });
}

async function cleanup(...notificationIds) {
  await UserNotification.destroy({ where: { id: notificationIds.filter(Boolean) } });
}

describe('notificationEscalationService', { skip: !dbReachable }, () => {
  it('a mandatory, immediate, unacknowledged notification past the threshold is escalated', async () => {
    const original = await makeCandidate({ ageMs: 20 * 60 * 1000 });
    let reminder;
    try {
      await escalateNotification(original);

      const reloadedOriginal = await UserNotification.findByPk(original.id);
      assert.ok(reloadedOriginal.escalatedAt, 'original must be marked escalated');

      reminder = await findReminderFor(original);
      assert.ok(reminder, 'a reminder notification must have been created');
      assert.equal(reminder.type, 'test.escalation.escalation');
      assert.equal(reminder.userId, original.userId);
    } finally {
      await cleanup(original.id, reminder?.id);
    }
  });

  it('the reminder is mandatory, references the original, and is born already escalated (no re-escalation chain)', async () => {
    const original = await makeCandidate({ ageMs: 20 * 60 * 1000 });
    let reminder;
    try {
      await escalateNotification(original);
      reminder = await findReminderFor(original);
      assert.ok(reminder);
      assert.equal(reminder.mandatory, true);
      assert.equal(reminder.metadata?.escalationOf, original.id);
      assert.ok(reminder.escalatedAt, 'reminder must be pre-marked escalated so it can never itself become a candidate');

      // Confirm it is actually excluded from a fresh candidate scan, not just
      // that the column happens to be set.
      const candidates = await findEscalationCandidates({ escalateAfterMs: 0 });
      assert.ok(
        !candidates.some((c) => c.id === reminder.id),
        'the reminder must not appear as its own escalation candidate',
      );
    } finally {
      await cleanup(original.id, reminder?.id);
    }
  });

  it('escalating the same notification twice does not create two reminders', async () => {
    const original = await makeCandidate({ ageMs: 20 * 60 * 1000 });
    let reminder;
    try {
      await escalateNotification(original);
      reminder = await findReminderFor(original);
      const firstReminderId = reminder.id;

      // Second call would only happen in practice if escalatedAt somehow
      // wasn't persisted yet when a concurrent tick re-read the same
      // candidate; publishNotification's own dedup key is the backstop.
      await escalateNotification(await UserNotification.findByPk(original.id));
      const stillOneReminder = await UserNotification.findAll({
        where: { userId: original.userId, clientDedupKey: `${original.userId}:escalation:${original.id}` },
      });
      assert.equal(stillOneReminder.length, 1);
      assert.equal(stillOneReminder[0].id, firstReminderId);
    } finally {
      await cleanup(original.id, reminder?.id);
    }
  });

  it('a candidate not yet past the threshold is left alone', async () => {
    const original = await makeCandidate({ ageMs: 1000 });
    try {
      const candidates = await findEscalationCandidates({ escalateAfterMs: 10 * 60 * 1000 });
      assert.ok(!candidates.some((c) => c.id === original.id));
    } finally {
      await cleanup(original.id);
    }
  });

  it('a non-mandatory notification is never a candidate, even if immediate + stale + unacknowledged', async () => {
    const original = await makeCandidate({ ageMs: 20 * 60 * 1000, mandatory: false });
    try {
      const candidates = await findEscalationCandidates({ escalateAfterMs: 10 * 60 * 1000 });
      assert.ok(!candidates.some((c) => c.id === original.id));
    } finally {
      await cleanup(original.id);
    }
  });

  it('a non-immediate-urgency notification is never a candidate, even if mandatory + stale + unacknowledged', async () => {
    const original = await makeCandidate({ ageMs: 20 * 60 * 1000, urgency: 'normal' });
    try {
      const candidates = await findEscalationCandidates({ escalateAfterMs: 10 * 60 * 1000 });
      assert.ok(!candidates.some((c) => c.id === original.id));
    } finally {
      await cleanup(original.id);
    }
  });

  it('an already-acknowledged notification is never a candidate', async () => {
    const original = await makeCandidate({ ageMs: 20 * 60 * 1000, acknowledgedAt: new Date() });
    try {
      const candidates = await findEscalationCandidates({ escalateAfterMs: 10 * 60 * 1000 });
      assert.ok(!candidates.some((c) => c.id === original.id));
    } finally {
      await cleanup(original.id);
    }
  });

  it('an already-escalated notification is never a candidate again', async () => {
    const original = await makeCandidate({ ageMs: 20 * 60 * 1000, escalatedAt: new Date() });
    try {
      const candidates = await findEscalationCandidates({ escalateAfterMs: 10 * 60 * 1000 });
      assert.ok(!candidates.some((c) => c.id === original.id));
    } finally {
      await cleanup(original.id);
    }
  });

  it('one candidate failing does not block the rest of the batch', async () => {
    const good = await makeCandidate({ ageMs: 20 * 60 * 1000 });
    const bad = await makeCandidate({ ageMs: 21 * 60 * 1000 });
    let reminder;
    try {
      const summary = await escalateOverdueNotifications(
        { escalateAfterMs: 10 * 60 * 1000 },
        {
          escalate: async (n) => {
            if (n.id === bad.id) throw new Error('simulated failure');
            return escalateNotification(n);
          },
        },
      );
      assert.equal(summary.checked, 2);
      assert.equal(summary.errors, 1);
      assert.equal(summary.escalated, 1);

      const reloadedGood = await UserNotification.findByPk(good.id);
      assert.ok(reloadedGood.escalatedAt, 'the good candidate must still have been escalated');
      const reloadedBad = await UserNotification.findByPk(bad.id);
      assert.equal(reloadedBad.escalatedAt, null, 'the failed candidate must not be marked escalated');

      reminder = await findReminderFor(good);
    } finally {
      await cleanup(good.id, bad.id, reminder?.id);
    }
  });

  it('respects the limit — a bounded sweep, not unbounded processing', async () => {
    const fixtures = await Promise.all([
      makeCandidate({ ageMs: 20 * 60 * 1000 }),
      makeCandidate({ ageMs: 20 * 60 * 1000 }),
      makeCandidate({ ageMs: 20 * 60 * 1000 }),
    ]);
    try {
      const candidates = await findEscalationCandidates({ escalateAfterMs: 10 * 60 * 1000, limit: 2 });
      assert.ok(candidates.length <= 2, `expected at most 2, got ${candidates.length}`);
    } finally {
      await cleanup(...fixtures.map((f) => f.id));
    }
  });
});
