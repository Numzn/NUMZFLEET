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
  processDelivery,
  runDeliveryWorkerOnce,
  computeNextAttemptAt,
  MAX_ATTEMPTS,
  WORKER_CHANNELS,
} from './deliveryWorker.js';
import { claimDueDeliveries, recoverStaleProcessing } from './deliveryRepository.js';
import { claimById, createParkedDeliveries } from './__testHelpers.js';

// Real Postgres — claiming, locking and recovery are database behaviours and
// cannot be proven with mocks.
let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

// ROOT CAUSE, confirmed by reproduction (see the Phase 4 verification report,
// not restated here): node --test runs multiple test FILES concurrently by
// default, all against the same shared dev Postgres. This file's own tenant-
// safety test intermittently failed with "both tenants' deliveries must be
// claimable" — proven, not assumed, to be caused by deliveryHardening.test.js
// (never deliveryRepository.test.js, never in isolation, never at
// --test-concurrency=1, and never correlated with the live background
// worker's own logs). The mechanism: claimDueDeliveries is channel + due-time
// scoped, matching a real worker that has no concept of "which test created
// this row" — so a sibling file's own wide claim can transiently hold this
// file's row (claim it as collateral, about to release it) at the exact
// moment this file's own claim checks for it.
//
// Fix, in two parts:
//   1. Every test that already knows its own delivery's id (the large
//      majority) now uses claimById() (__testHelpers.js) — claims that one
//      row by primary key and touches nothing else, so it has no channel/time
//      collision surface with any other file at all, by construction.
//   2. The couple of tests that are actually ABOUT claimDueDeliveries'
//      discovery/concurrency behavior keep using the real function (a
//      test-only shortcut would stop testing production code), made
//      deterministic instead via a DIFFERENT axis than timing: this file's
//      wide claims always use CHANNELS.PUSH; deliveryHardening.test.js's use
//      email; deliveryLifecycle.test.js's use sms. Channel is an exact-match
//      filter with no "later reaches earlier" asymmetry the way `<=` on a
//      timestamp has, so these can never collide, not just "rarely".
//
//      (deliveryLifecycle.test.js is pinned to sms, not a free choice: its
//      "complete lifecycle" tests go through the real, unfaced
//      publishNotification(), and effectiveChannelsResolver.js gates email
//      and push off by default for a fresh recipient with no preference row —
//      only inbox/websocket/sms dispatch unconditionally. So this file and
//      deliveryHardening.test.js take push/email between them instead.)
//
// FUTURE/TEST_NOW still exist so a stray row is never immediately due for the
// live background worker's own real-time claims, but they are no longer the
// thing making cross-file test claims safe from each other — claimById and
// channel separation are.
const FUTURE = new Date(Date.now() + 20 * 60 * 60 * 1000);
const TEST_NOW = new Date(Date.now() + 20.5 * 60 * 60 * 1000);

// Channel exclusivity alone is not enough for the couple of genuinely-wide
// claims below: this file's OTHER (claimById-protected) fixtures legitimately
// use sms/email/push for realistic per-channel coverage, and a sibling file's
// own wide claim on one of those same channels can still reach down into
// this file's FUTURE/TEST_NOW band (the `<=` asymmetry — see the ROOT CAUSE
// note). A wide claim's `now` only reaches rows parked AT OR BEFORE it, so
// keeping both the target's park time and the claim's `now` to a small,
// near-immediate offset — nowhere near any file's multi-hour band — means it
// structurally cannot reach anything except what this exact test just parked.
//
// Computed fresh at call time, NOT as a module-level constant: this file has
// many tests before these two, and a fixed "load time + 3s" value would
// already be in the past — and so immediately due for the REAL live
// background worker's real-time claims — by the time execution actually
// reaches them.
//
// This file owns the +0-9s band. deliveryLifecycle.test.js/
// deliveryHardening.test.js have their own identical helpers (copy-pasted
// from this one) and originally used this exact same offset, which — since
// Node's test runner executes files concurrently — let their genuinely-wide,
// unscoped claims collide with each other (confirmed by reproducing it
// locally, ~80% failure rate on the full suite). They now use +10-19s/
// +20-29s respectively; if you add a fourth file with this pattern, give it
// its own decade too.
function wideClaimWindow() {
  const now = Date.now();
  return { parkAt: new Date(now + 3000), claimNow: new Date(now + 4000) };
}

const COMPANY_A = randomUUID();
const COMPANY_B = randomUUID();
const createdNotificationIds = [];

async function makeDelivery(channel, { companyId = COMPANY_A, userId = 7001, status, parkAt = FUTURE } = {}) {
  const n = await UserNotification.create({
    userId,
    type: 'test.worker',
    category: 'system',
    severity: 'info',
    urgency: 'normal',
    title: 'Worker test',
    message: 'body',
    source: 'fuel-api',
    metadata: {},
    read: false,
    archived: false,
    tenantId: companyId,
    clientDedupKey: `${userId}:worker:${randomUUID()}`,
  });
  createdNotificationIds.push(n.id);
  // createParkedDeliveries sets nextAttemptAt (and, when given, status) in the
  // SAME insert, inside one transaction — the row is never externally
  // visible in the NULL-due, unconditionally-claimable state
  // createDeliveriesForNotification() + a separate follow-up update would
  // pass through. parkAt defaults to this file's own multi-hour band (see the
  // ROOT CAUSE note above) but the couple of genuinely-wide-claim tests
  // override it to a small, near-immediate offset instead — see
  // wideClaimWindow() below for why.
  const [delivery] = await createParkedDeliveries({
    notificationId: n.id,
    companyId,
    recipientUserId: userId,
    channels: [channel],
    nextAttemptAt: parkAt,
    ...(status ? { status } : {}),
  });
  return { notification: n, delivery };
}

/** A sender stub that records what it was asked to do. */
function stubSenders(result) {
  const calls = [];
  const fn = async (payload) => { calls.push(payload); return result; };
  return {
    calls,
    senders: {
      [CHANNELS.PUSH]: fn,
      [CHANNELS.SMS]: fn,
      [CHANNELS.EMAIL]: fn,
    },
  };
}

/**
 * For the couple of tests that do a genuine wide (not by-id) claim: release
 * anything caught in the batch besides `keepId`. Channel exclusivity between
 * files prevents most cross-file overlap, but a wide claim's `now` can still
 * reach down into an older, lower-banded file's same-channel rows (the `<=`
 * asymmetry — see the ROOT CAUSE note above) — this is the backstop so that
 * possibility, even though rare, can never leave another file's row stuck.
 */
async function releaseCollateral(batch, keepId) {
  const collateral = batch.filter((d) => d.id !== keepId);
  if (!collateral.length) return;
  await NotificationDelivery.update(
    { status: DELIVERY_STATUS.PENDING, lockedAt: null, lockedBy: null,
      attemptCount: sequelize.literal('attempt_count - 1') },
    { where: { id: collateral.map((d) => d.id) } },
  );
}

/**
 * Claim a specific, already-known delivery via claimById() (__testHelpers.js)
 * — by primary key only, so it can never collide with any other test file.
 * Most tests in this file just need their own fixture moved into
 * 'processing' to exercise what comes after; they are not testing
 * claimDueDeliveries' discovery behavior itself, so they do not need to go
 * through it. See the ROOT CAUSE note near the top of this file.
 */
async function claimMine(delivery) {
  // channel is no longer needed here — claimById claims by primary key only,
  // so it has no channel/time collision surface with any other test file.
  const mine = await claimById({ targetId: delivery.id, lockedBy: 'test-w', now: TEST_NOW });
  assert.ok(mine, 'expected this test\'s own delivery to be claimed');
  return mine;
}

before(async () => {
  if (!dbReachable) return;
  await Company.bulkCreate([
    { id: COMPANY_A, name: 'Worker Co A', slug: `worker-a-${COMPANY_A.slice(0, 8)}` },
    { id: COMPANY_B, name: 'Worker Co B', slug: `worker-b-${COMPANY_B.slice(0, 8)}` },
  ], { ignoreDuplicates: true });
});

after(async () => {
  if (!dbReachable) return;
  await UserNotification.destroy({ where: { id: createdNotificationIds } });
  await Company.destroy({ where: { id: [COMPANY_A, COMPANY_B] } });
});

describe('backoff policy', () => {
  it('grows exponentially and is bounded by a finite attempt cap', () => {
    const now = new Date('2026-09-03T10:00:00.000Z');
    const first = computeNextAttemptAt(1, now).getTime() - now.getTime();
    const second = computeNextAttemptAt(2, now).getTime() - now.getTime();
    const third = computeNextAttemptAt(3, now).getTime() - now.getTime();
    assert.ok(second > first, 'delay must grow');
    assert.ok(third > second, 'delay must keep growing');
    assert.equal(second, first * 2);
    assert.ok(Number.isFinite(MAX_ATTEMPTS) && MAX_ATTEMPTS > 0, 'retries must be bounded');
  });

  it('never schedules a retry in the past', () => {
    const now = new Date();
    assert.ok(computeNextAttemptAt(1, now) > now);
  });
});

describe('worker channel scope', () => {
  it('claims only external channels — inbox and websocket are never worker work', () => {
    assert.deepEqual([...WORKER_CHANNELS].sort(), ['email', 'push', 'sms']);
    assert.equal(WORKER_CHANNELS.includes(CHANNELS.INBOX), false);
    assert.equal(WORKER_CHANNELS.includes(CHANNELS.WEBSOCKET), false);
  });
});

describe('delivery worker', { skip: !dbReachable }, () => {
  it('discovers and claims a pending delivery, stamping the lock and attempt number', async () => {
    // This test is genuinely ABOUT claimDueDeliveries' discovery behavior, so
    // it uses the real function rather than claimById. Its own small,
    // near-immediate window (not this file's multi-hour FUTURE/TEST_NOW band)
    // is what keeps it deterministic against sibling files — see
    // wideClaimWindow() and the ROOT CAUSE note above.
    const { parkAt, claimNow } = wideClaimWindow();
    const { delivery } = await makeDelivery(CHANNELS.PUSH, { parkAt });
    const claimed = await claimDueDeliveries({
      channels: [CHANNELS.PUSH], limit: 10, lockedBy: 'test-worker-1', now: claimNow,
    });
    await releaseCollateral(claimed, delivery.id);
    const mine = claimed.find((d) => d.id === delivery.id);
    assert.ok(mine, 'the pending delivery must be discovered');
    assert.equal(mine.status, DELIVERY_STATUS.PROCESSING);
    assert.equal(mine.lockedBy, 'test-worker-1');
    assert.ok(mine.lockedAt);
    assert.equal(mine.attemptCount, 1, 'the claim stamps the attempt number');
  });

  it('concurrent workers cannot claim the same delivery', async () => {
    // Own small, near-immediate window (see wideClaimWindow) rather than this
    // file's multi-hour band — that band is what a sibling file's own wide
    // claim could otherwise reach down into.
    const { parkAt, claimNow } = wideClaimWindow();
    const { delivery } = await makeDelivery(CHANNELS.PUSH, { parkAt });

    // Several claimers at once, to actually provoke contention. The claim must
    // be safe on its own merits — the scheduler's advisory lock is a second
    // layer, not the thing being tested here. Scoped to PUSH only (this
    // delivery's own channel, and this file's reserved wide-claim channel —
    // see the ROOT CAUSE note above) rather than WORKER_CHANNELS, to minimize
    // what these four wide claims can sweep up from sibling files in the
    // first place.
    const batches = await Promise.all(
      ['A', 'B', 'C', 'D'].map((id) => claimDueDeliveries({
        channels: [CHANNELS.PUSH], limit: 50, lockedBy: `worker-${id}`, now: claimNow,
      })),
    );

    const claimCount = batches.reduce(
      (total, batch) => total + batch.filter((d) => d.id === delivery.id).length,
      0,
    );

    // Whatever any of these four calls claimed besides our own delivery is a
    // sibling file's row, caught in the same wide net — release it immediately
    // rather than leave it abandoned in 'processing' for that file to trip
    // over later.
    const collateral = batches.flat().filter((d) => d.id !== delivery.id);
    if (collateral.length) {
      await NotificationDelivery.update(
        { status: DELIVERY_STATUS.PENDING, lockedAt: null, lockedBy: null,
          attemptCount: sequelize.literal('attempt_count - 1') },
        { where: { id: collateral.map((d) => d.id) } },
      );
    }

    // <= 1, not === 1: node --test runs multiple FILES concurrently by
    // default, and a sibling file's own claim can (rarely) win this exact row
    // in the brief window between this test's creation and parking calls —
    // that is a cross-file test-isolation fact, not a claim-safety violation.
    // The property this test exists to prove is that none of these FOUR
    // callers can double-claim the same row, which <= 1 fully captures; the
    // row-level assertions below are the ones that prove the claim actually
    // succeeded exactly once, by whoever won it.
    assert.ok(claimCount <= 1, `at most one of these workers may claim a given delivery, got ${claimCount}`);

    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.attemptCount, 1, 'the claim must increment the attempt exactly once');
    assert.equal(reloaded.status, DELIVERY_STATUS.PROCESSING);
  });

  it('success: processing -> sent, with a provider message id recorded', async () => {
    const { delivery } = await makeDelivery(CHANNELS.SMS);
    const claimed = await claimMine(delivery);
    const { senders } = stubSenders({ ok: true, id: 'gw-msg-123' });

    const out = await processDelivery(claimed, { senders });
    assert.equal(out.status, DELIVERY_STATUS.SENT);

    const reloaded = await NotificationDelivery.findByPk(claimed.id);
    // 'sent' not 'delivered': the gateway accepted it, nobody confirmed receipt.
    assert.equal(reloaded.status, DELIVERY_STATUS.SENT);
    assert.ok(reloaded.sentAt);
    assert.equal(reloaded.lockedAt, null, 'a settled delivery must not keep a lock');

    const attempts = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: claimed.id } });
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].providerMessageId, 'gw-msg-123');
    assert.equal(attempts[0].provider, 'numz-sms-gateway');
  });

  it('retryable failure: processing -> retrying with a future next_attempt_at', async () => {
    const { delivery } = await makeDelivery(CHANNELS.EMAIL);
    const claimed = await claimMine(delivery);
    const { senders } = stubSenders({ ok: false, reason: 'send_failed', statusCode: 503 });

    const out = await processDelivery(claimed, { senders });
    assert.equal(out.status, DELIVERY_STATUS.RETRYING);

    const reloaded = await NotificationDelivery.findByPk(claimed.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.RETRYING);
    assert.ok(reloaded.nextAttemptAt > new Date(), 'retry must be scheduled in the future');
    assert.equal(reloaded.lockedAt, null, 'the lock is released while waiting');
  });

  it('permanent failure: processing -> failed, no retry scheduled', async () => {
    const { delivery } = await makeDelivery(CHANNELS.SMS);
    const claimed = await claimMine(delivery);
    const { senders } = stubSenders({ ok: false, reason: 'invalid_phone_number' });

    const out = await processDelivery(claimed, { senders });
    assert.equal(out.status, DELIVERY_STATUS.FAILED);

    const reloaded = await NotificationDelivery.findByPk(claimed.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.FAILED);
    assert.equal(reloaded.failureCode, 'invalid_phone_number');
    assert.equal(reloaded.nextAttemptAt, null, 'a settled delivery carries no pending retry');

    // The real guarantee: it is terminal, so no future claim can ever pick it
    // up again no matter how the clock moves. Deliberately a real-24h-future
    // clock, not this file's own TEST_NOW band — "no matter how the clock
    // moves" has to mean it. claimById touches only this one row regardless,
    // so the far-future clock poses no risk to any sibling file.
    const reclaimed = await claimById({
      targetId: claimed.id, lockedBy: 'w2', now: new Date(Date.now() + 86400000),
    });
    assert.equal(reclaimed, null, 'a permanently failed delivery must never be retried');
  });

  it('retry exhaustion: the final permitted attempt expires instead of retrying forever', async () => {
    const { delivery } = await makeDelivery(CHANNELS.EMAIL);
    // Pretend previous attempts already happened.
    await delivery.update({ attemptCount: MAX_ATTEMPTS - 1, status: DELIVERY_STATUS.RETRYING });
    const claimed = await claimMine(delivery);
    assert.equal(claimed.attemptCount, MAX_ATTEMPTS, 'this is the last permitted attempt');

    const { senders } = stubSenders({ ok: false, reason: 'send_failed', statusCode: 503 });
    const out = await processDelivery(claimed, { senders });
    assert.equal(out.status, DELIVERY_STATUS.EXPIRED);

    const reloaded = await NotificationDelivery.findByPk(claimed.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.EXPIRED);
  });

  it('records a separate attempt row per try — history is never overwritten', async () => {
    const { delivery } = await makeDelivery(CHANNELS.EMAIL);
    const { senders: failing } = stubSenders({ ok: false, reason: 'send_failed', statusCode: 503 });
    const { senders: succeeding } = stubSenders({ ok: true, id: 'msg-2' });

    const firstClaim = await claimMine(delivery);
    await processDelivery(firstClaim, { senders: failing });

    // Make the retry due, then claim again.
    // Still future-dated relative to the real scheduler, but due on our clock.
    await NotificationDelivery.update(
      { nextAttemptAt: FUTURE },
      { where: { id: delivery.id } },
    );
    const secondClaim = await claimMine(delivery);
    await processDelivery(secondClaim, { senders: succeeding });

    const attempts = await NotificationDeliveryAttempt.findAll({
      where: { deliveryId: delivery.id }, order: [['attempt_number', 'ASC']],
    });
    assert.equal(attempts.length, 2, 'both attempts must survive');
    assert.equal(attempts[0].status, DELIVERY_STATUS.FAILED);
    assert.equal(attempts[1].status, DELIVERY_STATUS.SENT);
    assert.equal(attempts[1].providerMessageId, 'msg-2');

    // Still exactly ONE logical delivery — a retry never forks a new one.
    const count = await NotificationDelivery.count({ where: { notificationId: delivery.notificationId } });
    assert.equal(count, 1);
  });

  it('a timeout is recorded as an uncertain outcome, not a definite non-send', async () => {
    const { delivery } = await makeDelivery(CHANNELS.SMS);
    const claimed = await claimMine(delivery);
    const { senders } = stubSenders({ ok: false, reason: 'send_failed', statusCode: 504, error: 'timed out' });

    const out = await processDelivery(claimed, { senders });
    assert.equal(out.status, DELIVERY_STATUS.RETRYING, 'a timeout is retryable');

    const reloaded = await NotificationDelivery.findByPk(claimed.id);
    assert.equal(reloaded.failureCode, 'timeout_uncertain');
    const [attempt] = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: claimed.id } });
    assert.match(attempt.failureReason, /outcome unknown/i);
  });

  it('push fans out to several devices as ONE logical delivery', async () => {
    const { delivery } = await makeDelivery(CHANNELS.PUSH);
    const claimed = await claimMine(delivery);
    const devices = [randomUUID(), randomUUID(), randomUUID()];
    const { senders } = stubSenders({
      ok: true,
      results: [
        { ok: true, id: devices[0] },
        { ok: false, id: devices[1], reason: 'expired_removed', expired: true },
        { ok: true, id: devices[2] },
      ],
    });

    const out = await processDelivery(claimed, { senders });
    assert.equal(out.status, DELIVERY_STATUS.SENT, 'one device succeeding is enough');

    const attempts = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: claimed.id } });
    assert.equal(attempts.length, 3, 'one attempt per device');
    const count = await NotificationDelivery.count({ where: { notificationId: delivery.notificationId } });
    assert.equal(count, 1, 'three devices must not become three deliveries');
  });

  it('zero push subscriptions produces an explicit, auditable outcome', async () => {
    const { delivery } = await makeDelivery(CHANNELS.PUSH);
    const claimed = await claimMine(delivery);
    const { senders } = stubSenders({ ok: false, reason: 'no_subscriptions' });

    const out = await processDelivery(claimed, { senders });
    assert.equal(out.status, DELIVERY_STATUS.FAILED, 'no devices is permanent, not endlessly retried');

    const reloaded = await NotificationDelivery.findByPk(claimed.id);
    assert.equal(reloaded.failureCode, 'no_subscriptions');
    const [attempt] = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: claimed.id } });
    assert.equal(attempt.failureCode, 'no_subscriptions', 'the reason must be auditable, not blank');
  });

  it('recovers a delivery abandoned by a crashed worker', async () => {
    const { delivery } = await makeDelivery(CHANNELS.SMS);
    // Simulate a worker that claimed and then died.
    await delivery.update({
      status: DELIVERY_STATUS.PROCESSING,
      lockedAt: new Date(Date.now() - 60 * 60 * 1000),
      lockedBy: 'dead-worker',
      attemptCount: 1,
    });

    const recovered = await recoverStaleProcessing({ staleBefore: new Date(Date.now() - 60 * 1000) });
    assert.ok(recovered >= 1);

    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.PENDING, 'must become claimable again');
    assert.equal(reloaded.lockedBy, null);
    // The crashed attempt still counted, so a crash loop cannot run forever.
    assert.equal(reloaded.attemptCount, 1);
  });

  it('does not recover a claim that is still fresh', async () => {
    const { delivery } = await makeDelivery(CHANNELS.SMS);
    await delivery.update({
      status: DELIVERY_STATUS.PROCESSING, lockedAt: new Date(), lockedBy: 'live-worker',
    });
    await recoverStaleProcessing({ staleBefore: new Date(Date.now() - 60 * 60 * 1000) });
    const reloaded = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(reloaded.status, DELIVERY_STATUS.PROCESSING, 'a live worker must not be interrupted');
  });

  it('a full tick claims, processes and reports outcomes', async () => {
    // Small, near-immediate window (see wideClaimWindow) — this claim is
    // genuinely wide across WORKER_CHANNELS with no channel restriction at
    // all, so at this file's own TEST_NOW it could reach into any other
    // file's smaller-banded fixtures on any channel (mineIds filtering below
    // only stops it from being FAKE-COMPLETED, not from being touched at all).
    const { parkAt, claimNow } = wideClaimWindow();
    const { delivery: sms } = await makeDelivery(CHANNELS.SMS, { parkAt });
    const { delivery: email } = await makeDelivery(CHANNELS.EMAIL, { parkAt });
    const mineIds = new Set([sms.id, email.id]);
    const { senders } = stubSenders({ ok: true, id: 'ok-1' });

    const summary = await runDeliveryWorkerOnce({
      limit: 50,
      now: claimNow,
      // A real tick would process everything it claims — this one processes
      // only its own two rows and immediately releases anything else it swept
      // up (a sibling file's pending row), so this genuinely-wide claim can't
      // "complete" another test's fixture with fake stub data.
      process: async (d) => {
        if (!mineIds.has(d.id)) {
          await NotificationDelivery.update(
            { status: DELIVERY_STATUS.PENDING, lockedAt: null, lockedBy: null,
              attemptCount: sequelize.literal('attempt_count - 1') },
            { where: { id: d.id } },
          );
          return { status: DELIVERY_STATUS.PENDING };
        }
        return processDelivery(d, { senders });
      },
    });
    assert.ok(summary.claimed >= 2);
    assert.ok(summary.results[DELIVERY_STATUS.SENT] >= 2);
  });
});

describe('worker tenant safety', { skip: !dbReachable }, () => {
  it('a delivery carries its own company and never borrows another', async () => {
    const { delivery: aDelivery } = await makeDelivery(CHANNELS.SMS, { companyId: COMPANY_A, userId: 7101 });
    const { delivery: bDelivery } = await makeDelivery(CHANNELS.SMS, { companyId: COMPANY_B, userId: 7102 });

    // claimDueDeliveries takes no companyId — by design (see deliveryRepository.js):
    // the worker is a background process, not a request, and legitimately
    // claims across every tenant in one pass, the same way
    // complianceNotificationScheduler.js's own sweep does. There is no
    // "company-scoped claim" to test here; claiming each by its own id (via
    // claimById, which touches only that one row — no channel, no scan, no
    // cross-file surface at all) is the correct and only claim shape. This is
    // also the test that originally exposed the cross-file race documented at
    // the top of this file: it used to go through the wide claimDueDeliveries
    // path and intermittently failed with "both tenants' deliveries must be
    // claimable" whenever deliveryHardening.test.js ran concurrently.
    const claimedA = await claimById({ targetId: aDelivery.id, lockedBy: 'w-a', now: TEST_NOW });
    const claimedB = await claimById({ targetId: bDelivery.id, lockedBy: 'w-b', now: TEST_NOW });
    assert.ok(claimedA && claimedB, 'both tenants\' deliveries must be claimable');

    // What actually protects tenant isolation is not the claim (deliberately
    // cross-tenant) but that every row the worker touches carries its own
    // tenant, so an attempt can never be written under the wrong company —
    // proven below via the attempt rows themselves, not via a claim filter.
    assert.equal(claimedA.companyId, COMPANY_A);
    assert.equal(claimedB.companyId, COMPANY_B);

    const { senders } = stubSenders({ ok: true, id: 'x' });
    await processDelivery(claimedA, { senders });

    const [attempt] = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: claimedA.id } });
    assert.equal(attempt.companyId, COMPANY_A, 'the attempt inherits the delivery tenant');

    const bAttempts = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: bDelivery.id } });
    assert.equal(bAttempts.length, 0, 'company B must be untouched');
  });
});
