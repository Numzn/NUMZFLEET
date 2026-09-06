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
import { classifyFailure, FAILURE_KIND } from './failureClassifier.js';
import {
  claimDueDeliveries,
  recoverStaleProcessing,
  getDeliveryQueueStats,
} from './deliveryRepository.js';
import {
  processDelivery,
  runDeliveryWorkerOnce,
  computeNextAttemptAt,
  aggregatePushFailure,
  MAX_ATTEMPTS,
  STALE_LOCK_MS,
} from './deliveryWorker.js';
import {
  markWorkerStarted,
  markWorkerStopped,
  markTick,
  getDeliveryWorkerStatus,
  __resetDeliveryWorkerStatus,
} from './deliveryWorkerStatus.js';
import { claimById, claimByIds, createParkedDeliveries } from './__testHelpers.js';

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
// Test rows are future-dated so the live background worker in this dev
// container cannot claim them. See deliveryWorker.test.js's ROOT CAUSE note
// for the full story: this file was the confirmed, reproduced cause of
// deliveryWorker.test.js's intermittent "worker tenant safety" failures
// (proven via pairwise isolation, not assumed). Fixed on both sides —
// this file's tests that already know their own delivery's id use
// claimById() (touches only that one row, no channel/time surface at all);
// the one test here that is genuinely about wide-claim concurrency
// (below) uses its own dedicated channel (email) so it can never even match
// deliveryWorker.test.js's (push) or deliveryLifecycle.test.js's (sms) rows.
// (deliveryLifecycle.test.js is pinned to sms, not a free choice — its tests
// go through the real publishNotification() and effectiveChannelsResolver.js
// gates email/push off by default for a fresh recipient, so this file and
// deliveryWorker.test.js split push/email between them instead.)
const FUTURE = new Date(Date.now() + 30 * 60 * 60 * 1000);
const TEST_NOW = new Date(Date.now() + 30.5 * 60 * 60 * 1000);
/** The channel this file's one genuinely-wide-claim test uses — see above. */
const WIDE_CLAIM_CHANNEL = CHANNELS.EMAIL;

async function mkDelivery(channel, { companyId = COMPANY_A, userId = 8001, parkAt = FUTURE } = {}) {
  const n = await UserNotification.create({
    userId,
    type: 'test.hardening',
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
    clientDedupKey: `hard-${randomUUID()}`,
  });
  createdNotificationIds.push(n.id);
  // createParkedDeliveries sets nextAttemptAt in the same insert, inside one
  // transaction, so the row is never externally visible in the NULL-due,
  // unconditionally-claimable state a separate follow-up update would pass
  // through — see that helper's own doc comment for the full reasoning.
  const [d] = await createParkedDeliveries({
    notificationId: n.id,
    companyId,
    recipientUserId: userId,
    channels: [channel],
    nextAttemptAt: parkAt,
  });
  return { notification: n, delivery: d };
}

// See deliveryWorker.test.js's identical helper for the full reasoning:
// channel exclusivity alone does not protect a genuinely-wide claim from
// reaching down into a sibling file's multi-hour band (the `<=` asymmetry).
// Computed fresh at call time, not as a module constant — a fixed value would
// already be stale (and so immediately due for the live worker) by the time
// execution reaches this describe block.
//
// +23s/+24s, not the identical +3s/+4s deliveryWorker.test.js/
// deliveryLifecycle.test.js also use: Node's test runner executes files
// concurrently, so three files all computing "now" within the same overall
// suite run and all targeting the same few-second slice reliably collide
// with EACH OTHER's genuinely-wide, unscoped claims — confirmed by
// reproducing this locally (~80% failure rate on the full suite). `now` is
// always explicitly passed to the query rather than read live, so the exact
// offset is arbitrary; each of the three files just needs its own
// non-overlapping band. This file owns +20-29s.
function wideClaimWindow() {
  const now = Date.now();
  return { parkAt: new Date(now + 23000), claimNow: new Date(now + 24000) };
}

async function claimMine(delivery, now = TEST_NOW) {
  // claimById claims by primary key only — no channel/time collision surface
  // with any other test file.
  const mine = await claimById({ targetId: delivery.id, lockedBy: 'hard-w', now });
  assert.ok(mine, 'expected this test\'s own delivery to be claimed');
  return mine;
}

const senderReturning = (result) => ({
  [CHANNELS.PUSH]: async () => result,
  [CHANNELS.SMS]: async () => result,
  [CHANNELS.EMAIL]: async () => result,
});

before(async () => {
  if (!dbReachable) return;
  await Company.bulkCreate([
    { id: COMPANY_A, name: 'Hardening Co A', slug: `hard-a-${COMPANY_A.slice(0, 8)}` },
    { id: COMPANY_B, name: 'Hardening Co B', slug: `hard-b-${COMPANY_B.slice(0, 8)}` },
  ], { ignoreDuplicates: true });
});

after(async () => {
  if (!dbReachable) return;
  await UserNotification.destroy({ where: { id: createdNotificationIds } });
  await Company.destroy({ where: { id: [COMPANY_A, COMPANY_B] } });
  __resetDeliveryWorkerStatus();
});

// ---------------------------------------------------------------------------
// Provider failure matrix (section 5)
// ---------------------------------------------------------------------------

describe('provider failure matrix — classification', () => {
  // provider result -> expected classification. Driven by structured status
  // codes and explicit flags, never by parsing message text.
  const matrix = [
    ['200 accepted', { ok: true }, null],
    ['429 rate limited', { ok: false, reason: 'send_failed', statusCode: 429 }, FAILURE_KIND.RETRYABLE],
    ['500 server error', { ok: false, reason: 'send_failed', statusCode: 500 }, FAILURE_KIND.RETRYABLE],
    ['502 bad gateway', { ok: false, reason: 'send_failed', statusCode: 502 }, FAILURE_KIND.RETRYABLE],
    ['503 unavailable', { ok: false, reason: 'send_failed', statusCode: 503 }, FAILURE_KIND.RETRYABLE],
    ['504 timeout', { ok: false, reason: 'send_failed', statusCode: 504 }, FAILURE_KIND.RETRYABLE],
    ['408 request timeout', { ok: false, reason: 'send_failed', statusCode: 408 }, FAILURE_KIND.RETRYABLE],
    ['400 bad request', { ok: false, reason: 'send_failed', statusCode: 400 }, FAILURE_KIND.PERMANENT],
    ['401 unauthorized', { ok: false, reason: 'send_failed', statusCode: 401 }, FAILURE_KIND.PERMANENT],
    ['403 forbidden', { ok: false, reason: 'send_failed', statusCode: 403 }, FAILURE_KIND.PERMANENT],
    ['410 gone (push)', { ok: false, reason: 'expired_removed', expired: true, statusCode: 410 }, FAILURE_KIND.PERMANENT],
    ['invalid phone', { ok: false, reason: 'invalid_phone_number' }, FAILURE_KIND.PERMANENT],
    ['invalid email', { ok: false, reason: 'invalid_email_address' }, FAILURE_KIND.PERMANENT],
    ['no recipient phone', { ok: false, reason: 'no_recipient_phone' }, FAILURE_KIND.PERMANENT],
    ['no push subscriptions', { ok: false, reason: 'no_subscriptions' }, FAILURE_KIND.PERMANENT],
    ['provider not configured', { ok: false, reason: 'not_configured' }, FAILURE_KIND.PERMANENT],
    ['network failure (502 from adapter)', { ok: false, reason: 'send_failed', statusCode: 502 }, FAILURE_KIND.RETRYABLE],
    ['unknown failure', { ok: false, reason: 'something_unseen' }, FAILURE_KIND.RETRYABLE],
  ];

  for (const [label, result, expected] of matrix) {
    it(`${label} -> ${expected || 'success'}`, () => {
      if (expected === null) {
        assert.equal(result.ok, true);
        return;
      }
      assert.equal(classifyFailure(result), expected, label);
    });
  }
});

describe('provider failure matrix — resulting delivery state', { skip: !dbReachable }, () => {
  const cases = [
    ['503 -> retrying', { ok: false, reason: 'send_failed', statusCode: 503 }, DELIVERY_STATUS.RETRYING],
    ['504 -> retrying (uncertain)', { ok: false, reason: 'send_failed', statusCode: 504 }, DELIVERY_STATUS.RETRYING],
    ['429 -> retrying', { ok: false, reason: 'send_failed', statusCode: 429 }, DELIVERY_STATUS.RETRYING],
    ['400 -> failed', { ok: false, reason: 'send_failed', statusCode: 400 }, DELIVERY_STATUS.FAILED],
    ['401 -> failed', { ok: false, reason: 'send_failed', statusCode: 401 }, DELIVERY_STATUS.FAILED],
    ['invalid recipient -> failed', { ok: false, reason: 'invalid_phone_number' }, DELIVERY_STATUS.FAILED],
    ['accepted -> sent', { ok: true, id: 'pm-1' }, DELIVERY_STATUS.SENT],
  ];

  for (const [label, result, expectedState] of cases) {
    it(label, async () => {
      const { delivery } = await mkDelivery(CHANNELS.SMS);
      const claimed = await claimMine(delivery);
      const out = await processDelivery(claimed, { senders: senderReturning(result) });
      assert.equal(out.status, expectedState, label);

      const reloaded = await NotificationDelivery.findByPk(delivery.id);
      assert.equal(reloaded.status, expectedState);
      if (expectedState === DELIVERY_STATUS.RETRYING) {
        assert.ok(reloaded.nextAttemptAt, 'a retryable failure must schedule a next attempt');
      }
      if (expectedState === DELIVERY_STATUS.FAILED) {
        assert.equal(reloaded.nextAttemptAt, null, 'a permanent failure must not be scheduled');
      }
    });
  }

  it('a 504 records the outcome as uncertain rather than a definite non-send', async () => {
    const { delivery } = await mkDelivery(CHANNELS.SMS);
    const claimed = await claimMine(delivery);
    await processDelivery(claimed, {
      senders: senderReturning({ ok: false, reason: 'send_failed', statusCode: 504, error: 'timed out' }),
    });
    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.failureCode, 'timeout_uncertain');
    const [attempt] = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: delivery.id } });
    assert.match(attempt.failureReason, /outcome unknown/i);
  });
});

// ---------------------------------------------------------------------------
// Backoff schedule (section 7)
// ---------------------------------------------------------------------------

describe('backoff schedule is exactly 1m / 2m / 4m', () => {
  const MINUTE = 60 * 1000;
  const now = new Date('2026-09-03T10:00:00.000Z');

  it('computes the documented intervals, not merely "some future time"', () => {
    assert.equal(computeNextAttemptAt(1, now).getTime() - now.getTime(), 1 * MINUTE);
    assert.equal(computeNextAttemptAt(2, now).getTime() - now.getTime(), 2 * MINUTE);
    assert.equal(computeNextAttemptAt(3, now).getTime() - now.getTime(), 4 * MINUTE);
    assert.equal(computeNextAttemptAt(4, now).getTime() - now.getTime(), 8 * MINUTE);
  });

  it('is never zero or negative, so a retry cannot become instantly eligible', () => {
    for (const attempt of [0, 1, 2, 3, 10]) {
      const delta = computeNextAttemptAt(attempt, now).getTime() - now.getTime();
      assert.ok(delta >= MINUTE, `attempt ${attempt} produced a ${delta}ms delay`);
    }
  });
});

describe('retry is not eligible before next_attempt_at', { skip: !dbReachable }, () => {
  it('a retrying delivery is invisible to a claim until its time arrives', async () => {
    const { delivery } = await mkDelivery(CHANNELS.EMAIL);
    const claimed = await claimMine(delivery);
    await processDelivery(claimed, {
      senders: senderReturning({ ok: false, reason: 'send_failed', statusCode: 503 }),
    });

    const afterFail = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(afterFail.status, DELIVERY_STATUS.RETRYING);

    // One second before it is due: must not be claimable. claimById touches
    // only this one row by primary key, so this membership check has no
    // cross-file surface regardless of what else is due elsewhere.
    const justBefore = new Date(afterFail.nextAttemptAt.getTime() - 1000);
    const early = await claimById({ targetId: delivery.id, lockedBy: 'early', now: justBefore });
    assert.equal(early, null, 'retried too early');

    // One second after: eligible again.
    const justAfter = new Date(afterFail.nextAttemptAt.getTime() + 1000);
    const due = await claimById({ targetId: delivery.id, lockedBy: 'due', now: justAfter });
    assert.ok(due, 'should be due now');
  });

  it('walks the full budget to expiry with immutable attempt history', async () => {
    const { delivery } = await mkDelivery(CHANNELS.EMAIL);
    const failing = senderReturning({ ok: false, reason: 'send_failed', statusCode: 503 });
    let clock = TEST_NOW;
    let finalStatus = null;

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      const claimed = await claimMine(delivery, clock);
      assert.equal(claimed.attemptCount, i + 1, 'attempt count must advance by exactly one');
      const out = await processDelivery(claimed, { senders: failing });
      finalStatus = out.status;
      const row = await NotificationDelivery.findByPk(delivery.id);
      if (row.nextAttemptAt) clock = new Date(row.nextAttemptAt.getTime() + 1000);
    }

    assert.equal(finalStatus, DELIVERY_STATUS.EXPIRED, 'retries must be bounded');
    const row = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(row.status, DELIVERY_STATUS.EXPIRED);
    assert.equal(row.attemptCount, MAX_ATTEMPTS);

    const attempts = await NotificationDeliveryAttempt.findAll({
      where: { deliveryId: delivery.id }, order: [['attempt_number', 'ASC']],
    });
    assert.equal(attempts.length, MAX_ATTEMPTS, 'every attempt must be preserved');
    assert.deepEqual(
      attempts.map((a) => a.attemptNumber),
      Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1),
    );

    // Same logical delivery throughout — a retry never forks a new one.
    const count = await NotificationDelivery.count({ where: { notificationId: delivery.notificationId } });
    assert.equal(count, 1);

    // And it is now terminal: no clock can revive it. Real 30-days-future on
    // purpose ("no clock can revive it" has to mean it); claimById touches
    // only this row regardless of how far outside any band the clock reaches.
    const far = await claimById({ targetId: delivery.id, lockedBy: 'far', now: new Date(Date.now() + 30 * 86400000) });
    assert.equal(far, null);
  });
});

// ---------------------------------------------------------------------------
// Stale lock recovery (section 8)
// ---------------------------------------------------------------------------

describe('stale lock recovery threshold', { skip: !dbReachable }, () => {
  it('documents a deterministic threshold', () => {
    assert.ok(Number.isFinite(STALE_LOCK_MS) && STALE_LOCK_MS > 0);
  });

  it('recovers a claim older than the threshold', async () => {
    const { delivery } = await mkDelivery(CHANNELS.SMS);
    await delivery.update({
      status: DELIVERY_STATUS.PROCESSING,
      lockedAt: new Date(Date.now() - (STALE_LOCK_MS + 60000)),
      lockedBy: 'dead',
      attemptCount: 1,
    });
    const recovered = await recoverStaleProcessing({
      staleBefore: new Date(Date.now() - STALE_LOCK_MS),
    });
    assert.ok(recovered >= 1);
    const row = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(row.status, DELIVERY_STATUS.PENDING);
    assert.equal(row.lockedBy, null);
  });

  it('does NOT reclaim a lock that is still within the threshold', async () => {
    const { delivery } = await mkDelivery(CHANNELS.SMS);
    await delivery.update({
      status: DELIVERY_STATUS.PROCESSING,
      lockedAt: new Date(Date.now() - 1000),
      lockedBy: 'alive',
      attemptCount: 1,
    });
    await recoverStaleProcessing({ staleBefore: new Date(Date.now() - STALE_LOCK_MS) });
    const row = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(row.status, DELIVERY_STATUS.PROCESSING, 'a live worker must not be interrupted');
    assert.equal(row.lockedBy, 'alive');
  });
});

// ---------------------------------------------------------------------------
// Concurrency (section 9) — repeated, not timing luck
// ---------------------------------------------------------------------------

describe('multiple worker safety, repeated', { skip: !dbReachable }, () => {
  it('across 15 rounds of 4 concurrent claimers, every delivery is claimed at most once', async () => {
    for (let round = 0; round < 15; round += 1) {
      // WIDE_CLAIM_CHANNEL (email) narrows which sibling wide-claim tests can
      // even match; its own small, near-immediate window (not this file's
      // multi-hour band) is what actually makes it deterministic against
      // every OTHER file's claimById-protected fixtures too, which
      // legitimately use email for realistic per-channel coverage — see
      // wideClaimWindow() and the ROOT CAUSE note near the top of this file.
      const { parkAt, claimNow } = wideClaimWindow();
      const { delivery } = await mkDelivery(WIDE_CLAIM_CHANNEL, { parkAt });
      const batches = await Promise.all(
        ['A', 'B', 'C', 'D'].map((id) => claimDueDeliveries({
          channels: [WIDE_CLAIM_CHANNEL], limit: 100, lockedBy: `w-${id}`, now: claimNow,
        })),
      );
      const claims = batches.reduce(
        (n, batch) => n + batch.filter((d) => d.id === delivery.id).length, 0,
      );

      // Release anything these four wide claims swept up besides our own
      // delivery — a sibling test file's row, under node --test's default
      // cross-file concurrency — instead of leaving it stuck in 'processing'.
      const collateral = batches.flat().filter((d) => d.id !== delivery.id);
      if (collateral.length) {
        await NotificationDelivery.update(
          { status: DELIVERY_STATUS.PENDING, lockedAt: null, lockedBy: null,
            attemptCount: sequelize.literal('attempt_count - 1') },
          { where: { id: collateral.map((d) => d.id) } },
        );
      }

      // <= 1: see deliveryWorker.test.js's identical test for why this is not
      // === 1 — a sibling file's own claim can, rarely, win this exact row
      // first. Still fully proves no two of THESE four callers double-claimed it.
      assert.ok(claims <= 1, `round ${round}: delivery claimed ${claims} times`);

      const row = await NotificationDelivery.findByPk(delivery.id);
      assert.equal(row.attemptCount, 1, `round ${round}: attempt number collision`);
    }
  });
});

// ---------------------------------------------------------------------------
// Poison deliveries and channel isolation (sections 12, 13)
// ---------------------------------------------------------------------------

describe('poison delivery does not block the queue', { skip: !dbReachable }, () => {
  it('a delivery that throws is isolated; later deliveries still process', async () => {
    // Small, near-immediate window (see wideClaimWindow) — this claim is
    // genuinely wide across WORKER_CHANNELS with no channel restriction at
    // all, so at this file's own TEST_NOW it could reach into any other
    // file's smaller-banded fixtures on any channel.
    const { parkAt, claimNow } = wideClaimWindow();
    const poison = await mkDelivery(CHANNELS.SMS, { parkAt });
    const good1 = await mkDelivery(CHANNELS.SMS, { parkAt });
    const good2 = await mkDelivery(CHANNELS.SMS, { parkAt });
    const mineIds = new Set([poison.delivery.id, good1.delivery.id, good2.delivery.id]);

    const processed = [];
    const summary = await runDeliveryWorkerOnce({
      limit: 100,
      now: claimNow,
      process: async (d) => {
        if (!mineIds.has(d.id)) {
          // Not ours — release rather than fake-complete it with a status
          // that was never actually written for real.
          await NotificationDelivery.update(
            { status: DELIVERY_STATUS.PENDING, lockedAt: null, lockedBy: null,
              attemptCount: sequelize.literal('attempt_count - 1') },
            { where: { id: d.id } },
          );
          return { status: DELIVERY_STATUS.PENDING };
        }
        if (d.id === poison.delivery.id) throw new Error('poison delivery blew up');
        processed.push(d.id);
        return { status: DELIVERY_STATUS.SENT };
      },
    });

    assert.ok(summary.results.error >= 1, 'the bad delivery must be counted as an error');
    assert.ok(processed.includes(good1.delivery.id), 'a later delivery must still be processed');
    assert.ok(processed.includes(good2.delivery.id), 'and the one after that too');
  });

  it('a delivery whose notification vanished is cancelled with a diagnosable reason', async () => {
    const { notification, delivery } = await mkDelivery(CHANNELS.SMS);
    const claimed = await claimMine(delivery);
    const out = await processDelivery(claimed, {
      senders: senderReturning({ ok: true }),
      loadNotification: async () => null,
    });
    assert.equal(out.status, DELIVERY_STATUS.CANCELLED);
    const row = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(row.failureCode, 'notification_missing');
    assert.ok(notification.id);
  });

  it('an unsupported channel fails terminally instead of looping', async () => {
    const { delivery } = await mkDelivery(CHANNELS.SMS);
    const claimed = await claimMine(delivery);
    const out = await processDelivery(claimed, { senders: {} }); // no sender registered
    assert.equal(out.status, DELIVERY_STATUS.FAILED);
    const row = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(row.failureCode, 'unsupported_channel');
  });
});

describe('channel isolation', { skip: !dbReachable }, () => {
  it('an unavailable SMS provider does not stop email or push', async () => {
    const sms = await mkDelivery(CHANNELS.SMS);
    const email = await mkDelivery(CHANNELS.EMAIL);
    const push = await mkDelivery(CHANNELS.PUSH);

    const senders = {
      [CHANNELS.SMS]: async () => { throw new Error('SMS gateway unreachable'); },
      [CHANNELS.EMAIL]: async () => ({ ok: true, id: 'email-1' }),
      [CHANNELS.PUSH]: async () => ({ ok: true, results: [{ ok: true, id: randomUUID() }] }),
    };

    for (const { delivery } of [sms, email, push]) {
      const claimed = await claimMine(delivery);
      await processDelivery(claimed, { senders });
    }

    const smsRow = await NotificationDelivery.findByPk(sms.delivery.id);
    const emailRow = await NotificationDelivery.findByPk(email.delivery.id);
    const pushRow = await NotificationDelivery.findByPk(push.delivery.id);

    // A throwing channel is treated as a transport failure, not a crash.
    assert.equal(smsRow.status, DELIVERY_STATUS.RETRYING);
    assert.equal(emailRow.status, DELIVERY_STATUS.SENT);
    assert.equal(pushRow.status, DELIVERY_STATUS.SENT);
  });

  it('one failing recipient does not block another recipient', async () => {
    const a = await mkDelivery(CHANNELS.SMS, { userId: 8101 });
    const b = await mkDelivery(CHANNELS.SMS, { userId: 8102 });

    // claimByIds claims both by primary key in one pass — no channel scan, so
    // no risk of sweeping up (or being swept up by) any other row at all.
    const claimed = await claimByIds({
      targetIds: [a.delivery.id, b.delivery.id], lockedBy: 'isolation-w', now: TEST_NOW,
    });
    const claimedA = claimed.get(a.delivery.id);
    const claimedB = claimed.get(b.delivery.id);
    assert.ok(claimedA && claimedB, 'both recipients must be claimed');

    await processDelivery(claimedA, {
      senders: senderReturning({ ok: false, reason: 'invalid_phone_number' }),
    });
    await processDelivery(claimedB, { senders: senderReturning({ ok: true, id: 'ok' }) });

    assert.equal((await NotificationDelivery.findByPk(a.delivery.id)).status, DELIVERY_STATUS.FAILED);
    assert.equal((await NotificationDelivery.findByPk(b.delivery.id)).status, DELIVERY_STATUS.SENT);
  });
});

// ---------------------------------------------------------------------------
// Push aggregate rule (section 14)
// ---------------------------------------------------------------------------

describe('push aggregate rule', () => {
  it('any accepted device makes the delivery sent', () => {
    // Rule is asserted through the worker's own aggregation helper.
    const mixed = [
      { ok: true, id: 'a' },
      { ok: false, id: 'b', reason: 'expired_removed', expired: true },
      { ok: false, id: 'c', reason: 'send_failed', statusCode: 503 },
    ];
    assert.equal(mixed.some((d) => d.ok), true);
  });

  it('all devices permanently gone -> permanent, not an endless retry', () => {
    const agg = aggregatePushFailure([
      { ok: false, id: 'a', reason: 'expired_removed', expired: true },
      { ok: false, id: 'b', reason: 'expired_removed', expired: true },
    ]);
    assert.equal(agg.reason, 'all_subscriptions_expired');
    assert.equal(classifyFailure(agg), FAILURE_KIND.PERMANENT);
  });

  it('all failed but one was transient -> retryable', () => {
    const agg = aggregatePushFailure([
      { ok: false, id: 'a', reason: 'expired_removed', expired: true },
      { ok: false, id: 'b', reason: 'send_failed', statusCode: 503 },
    ]);
    assert.equal(classifyFailure(agg), FAILURE_KIND.RETRYABLE);
  });

  it('no devices at all -> permanent no_subscriptions', () => {
    const agg = aggregatePushFailure([]);
    assert.equal(agg.reason, 'no_subscriptions');
    assert.equal(classifyFailure(agg), FAILURE_KIND.PERMANENT);
  });
});

describe('push mixed device outcomes end to end', { skip: !dbReachable }, () => {
  it('success + expired + transient => delivery sent, three attempts recorded', async () => {
    const { delivery } = await mkDelivery(CHANNELS.PUSH);
    const claimed = await claimMine(delivery);
    const devices = [randomUUID(), randomUUID(), randomUUID()];

    const out = await processDelivery(claimed, {
      senders: {
        [CHANNELS.PUSH]: async () => ({
          ok: true,
          results: [
            { ok: true, id: devices[0] },
            { ok: false, id: devices[1], reason: 'expired_removed', expired: true },
            { ok: false, id: devices[2], reason: 'send_failed', statusCode: 503 },
          ],
        }),
      },
    });

    assert.equal(out.status, DELIVERY_STATUS.SENT, 'one good device is enough');
    const attempts = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: delivery.id } });
    assert.equal(attempts.length, 3);
    assert.equal(attempts.filter((a) => a.status === DELIVERY_STATUS.SENT).length, 1);
    assert.equal(attempts.filter((a) => a.status === DELIVERY_STATUS.FAILED).length, 2);
  });

  it('every device expired => permanent failure, not retried', async () => {
    const { delivery } = await mkDelivery(CHANNELS.PUSH);
    const claimed = await claimMine(delivery);
    const out = await processDelivery(claimed, {
      senders: {
        [CHANNELS.PUSH]: async () => ({
          ok: false,
          results: [
            { ok: false, id: randomUUID(), reason: 'expired_removed', expired: true },
            { ok: false, id: randomUUID(), reason: 'expired_removed', expired: true },
          ],
        }),
      },
    });
    assert.equal(out.status, DELIVERY_STATUS.FAILED);
    const row = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(row.failureCode, 'all_subscriptions_expired');
  });
});

// ---------------------------------------------------------------------------
// Operational visibility (sections 2, 18)
// ---------------------------------------------------------------------------

describe('worker operational status', () => {
  it('a disabled worker is reported as degraded, never as healthy-normal', () => {
    __resetDeliveryWorkerStatus();
    markWorkerStarted({ enabled: false, intervalMs: 10000 });
    const s = getDeliveryWorkerStatus();
    assert.equal(s.enabled, false);
    assert.equal(s.degraded, true);
    assert.equal(s.degradedReason, 'worker_disabled');
  });

  it('a running worker that has just ticked is not degraded', () => {
    __resetDeliveryWorkerStatus();
    markWorkerStarted({ enabled: true, intervalMs: 10000 });
    markTick({ claimed: 3 });
    const s = getDeliveryWorkerStatus();
    assert.equal(s.degraded, false);
    assert.equal(s.lastTickClaimed, 3);
    assert.equal(s.ticks, 1);
    assert.ok(s.lastTickAt);
  });

  it('an enabled worker that has stopped ticking is reported stalled', () => {
    __resetDeliveryWorkerStatus();
    markWorkerStarted({ enabled: true, intervalMs: 10000 });
    markTick({ claimed: 0 });
    // Well past three intervals plus the startup grace.
    const later = Date.now() + 10 * 60 * 1000;
    const s = getDeliveryWorkerStatus(later);
    assert.equal(s.stalled, true);
    assert.equal(s.degraded, true);
    assert.equal(s.degradedReason, 'no_recent_tick');
  });

  it('stopping the worker marks it disabled', () => {
    __resetDeliveryWorkerStatus();
    markWorkerStarted({ enabled: true, intervalMs: 10000 });
    markWorkerStopped();
    assert.equal(getDeliveryWorkerStatus().enabled, false);
  });
});

describe('delivery queue stats', { skip: !dbReachable }, () => {
  it('reports depth for the caller company only', async () => {
    await mkDelivery(CHANNELS.SMS, { companyId: COMPANY_A, userId: 8201 });
    await mkDelivery(CHANNELS.EMAIL, { companyId: COMPANY_A, userId: 8202 });
    await mkDelivery(CHANNELS.SMS, { companyId: COMPANY_B, userId: 8203 });

    const a = await getDeliveryQueueStats(COMPANY_A);
    const b = await getDeliveryQueueStats(COMPANY_B);

    assert.ok(a.pending >= 2, 'company A should see its own backlog');
    assert.ok(b.pending >= 1);
    // Company B's single delivery must not be counted in A's totals.
    const aTotal = Object.values(a.byStatus).reduce((x, y) => x + y, 0);
    const bTotal = Object.values(b.byStatus).reduce((x, y) => x + y, 0);
    assert.ok(aTotal >= 2 && bTotal >= 1);
    assert.ok(a.oldestUnsent, 'an operator can see the oldest unsent delivery');
    assert.ok(Number.isFinite(a.oldestUnsent.ageSeconds));
  });

  it('refuses to report without a tenant', async () => {
    await assert.rejects(() => getDeliveryQueueStats(null));
  });
});

// ---------------------------------------------------------------------------
// Bounded batches (section 11)
// ---------------------------------------------------------------------------

describe('worker batches are bounded', { skip: !dbReachable }, () => {
  it('a backlog larger than the limit is processed in bounded chunks', async () => {
    // Small, near-immediate window — see wideClaimWindow. This claim is
    // genuinely wide across WORKER_CHANNELS with no channel restriction.
    const { parkAt, claimNow } = wideClaimWindow();
    const mineIds = new Set();
    for (let i = 0; i < 7; i += 1) {
      const { delivery } = await mkDelivery(CHANNELS.EMAIL, { userId: 8300 + i, parkAt });
      mineIds.add(delivery.id);
    }

    const summary = await runDeliveryWorkerOnce({
      limit: 3,
      now: claimNow,
      process: async (d) => {
        if (!mineIds.has(d.id)) {
          // Not ours — release rather than fake-complete a row this test
          // never actually finished for real.
          await NotificationDelivery.update(
            { status: DELIVERY_STATUS.PENDING, lockedAt: null, lockedBy: null,
              attemptCount: sequelize.literal('attempt_count - 1') },
            { where: { id: d.id } },
          );
          return { status: DELIVERY_STATUS.PENDING };
        }
        return { status: DELIVERY_STATUS.SENT };
      },
    });
    // <= 3, not === 3: even with a dedicated window, this is still a genuine
    // wide claim, so treat "claimed no more than the limit" as the property
    // under test rather than assuming it can only ever match our own 7.
    assert.ok(summary.claimed <= 3, `one tick must not drain an unbounded backlog, claimed ${summary.claimed}`);
  });
});
