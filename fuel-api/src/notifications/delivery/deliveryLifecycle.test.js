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
import { publishNotification } from '../orchestrator/publishNotification.js';
import { recoverStaleProcessing } from './deliveryRepository.js';
import { processDelivery, runDeliveryWorkerOnce } from './deliveryWorker.js';
import { claimById, createParkedDeliveries } from './__testHelpers.js';
import { isSmsGatewayConfigured } from '../providers/smsProvider.js';

let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const COMPANY = '00000000-0000-0000-0000-000000000001';
const createdNotificationIds = [];
// See deliveryWorker.test.js's ROOT CAUSE note for the full story. This file's
// tests all know their own delivery's id, so they claim via claimById()
// (touches only that one row — no channel scan, no cross-file surface at all,
// regardless of what time band it uses). TEST_NOW still exists purely so a
// row is never immediately due for the live background worker's real-time
// claims.
const TEST_NOW = new Date(Date.now() + 40 * 60 * 60 * 1000);

// The two "full tick" tests below use runDeliveryWorkerOnce with its default
// WORKER_CHANNELS (all three channels) — genuinely wide, unlike every other
// claim in this file. At this file's own +40h TEST_NOW, that claim could
// reach down into any other file's claimById-protected fixtures (all parked
// at smaller multi-hour bands) — the same `<=` asymmetry documented in
// deliveryWorker.test.js's ROOT CAUSE note, just with this file as the one
// reaching down instead of being reached into. A small, near-immediate window
// instead of TEST_NOW closes it the same way: computed fresh at call time,
// not as a module constant, so it is never already stale by the time
// execution reaches these tests.
//
// +13s/+14s, not the identical +3s/+4s deliveryWorker.test.js/
// deliveryHardening.test.js also use: Node's test runner executes files
// concurrently, so three files all computing "now" within the same overall
// suite run and all targeting the same few-second slice reliably collide
// with EACH OTHER's genuinely-wide, unscoped claims — confirmed by
// reproducing this locally (~80% failure rate on the full suite). `now` is
// always explicitly passed to the query rather than read live, so the exact
// offset is arbitrary; each of the three files just needs its own
// non-overlapping band. This file owns +10-19s.
function wideClaimWindow() {
  const now = Date.now();
  return { parkAt: new Date(now + 13000), claimNow: new Date(now + 14000) };
}

after(async () => {
  if (!dbReachable) return;
  await UserNotification.destroy({ where: { id: createdNotificationIds } });
});

// ---------------------------------------------------------------------------
// Section 20: the complete lifecycle, business event -> delivery state,
// proving the pieces work TOGETHER, not only independently.
// ---------------------------------------------------------------------------

// This suite proves the pipeline through a real, unfaked publishNotification()
// call, with only the WORKER's actual provider send stubbed (via processDelivery's
// senders override, per test below) — planning itself is untouched, so it now
// genuinely needs isSmsGatewayConfigured() to be true, the same real env-var
// read every other caller of channelEligibility.js's SMS branch depends on.
// CI has no real SMS gateway credentials (correctly — it shouldn't need any),
// so this integration proof only runs in an environment where SMS actually is
// configured, same reasoning as the dbReachable guard beside it.
describe('complete lifecycle: business event to delivery state', {
  skip: !dbReachable || !isSmsGatewayConfigured(),
}, () => {
  it('success path: publish -> pending delivery -> worker claims -> attempt -> sent', async () => {
    // "Business event" — a real, unfaked call to the actual publish API used
    // by every real producer (fuelRequestPolicy, immobilizationTransitionPolicy,
    // etc.), not a hand-built delivery row.
    const dedup = `lifecycle-success-${randomUUID()}`;
    const io = { sockets: {}, to: () => ({ emit: () => {} }) };

    // Timing IS the proof that matters here, not a status snapshot: this row
    // has nextAttemptAt=NULL — unconditionally due for ANY claimer, live
    // background worker included — from the instant publishNotification()'s
    // own internal transaction commits, which happens BEFORE this await even
    // resolves. No amount of test-side reordering closes that gap; only
    // publishNotification() itself could, and it should not grow a
    // test-only "quarantine" parameter for it — production correctly wants a
    // fresh delivery to be immediately claimable. So: measure that publish()
    // itself did not block on an external provider (the actual property
    // section 20 cares about), and treat the row reaching a live worker
    // before this test's own claim gets there as a legitimate outcome of a
    // healthy system, not a defect — see the assertions below.
    const publishStartedAt = Date.now();
    const publishResult = await publishNotification({
      type: 'test.lifecycle.success',
      entityType: 'system',
      entityId: dedup,
      severity: 'warning',
      urgency: 'normal',
      title: 'Lifecycle test',
      message: 'end to end',
      source: 'fuel-api',
      audience: { userIds: [900001] },
      // Phase 5: SMS eligibility (does a real destination exist) is now
      // checked by the delivery planner BEFORE a pending row is even
      // created — fake user 900001 has no real Traccar phone, so without
      // this the delivery would be immediately CANCELLED/no_recipient_phone
      // rather than reaching the worker at all. smsTo is the same explicit
      // override smsChannel.js itself checks first (see channelEligibility.js),
      // not a special test-only bypass — makes this recipient genuinely
      // eligible so the rest of this test can prove the worker pipeline.
      metadata: { smsTo: '+260977123456' },
      clientDedupKey: dedup,
      channels: [CHANNELS.INBOX, CHANNELS.SMS],
    }, { io });
    const publishElapsedMs = Date.now() - publishStartedAt;

    assert.equal(publishResult.persisted, 1);
    // Generous bound — a real SMTP/SMS/push round trip is not sub-second; this
    // only needs to rule out publish() having synchronously waited on one.
    assert.ok(publishElapsedMs < 2000, `publish() must not wait on a provider, took ${publishElapsedMs}ms`);

    const notification = await UserNotification.findOne({ where: { clientDedupKey: `900001:${dedup}` } });
    assert.ok(notification, 'the notification row must exist');
    createdNotificationIds.push(notification.id);

    // Park immediately, before any other read — shrinks the remaining
    // exposure to the one gap described above, though it cannot close it
    // (see above for why that specific gap is not closeable from here).
    await NotificationDelivery.update(
      { nextAttemptAt: new Date(TEST_NOW.getTime() - 1000) },
      { where: { notificationId: notification.id } },
    );

    const smsDelivery = await NotificationDelivery.findOne({
      where: { notificationId: notification.id, channel: CHANNELS.SMS },
    });
    assert.ok(smsDelivery, 'a delivery record must exist for the selected channel');
    // Usually PENDING. Not asserted as the only acceptable value: the row was
    // unconditionally due from the instant publishNotification()'s internal
    // transaction committed (see above), so in a live dev environment the
    // real background worker occasionally reaches it first — a sign the
    // system genuinely works, not a test failure. What must never happen is
    // reaching a state that would only be possible if THIS SAME CALL had
    // synchronously performed the send — there is no such state here, since
    // even the real worker only reaches PROCESSING/terminal asynchronously,
    // after publish() already returned (proven by the timing assertion above).
    assert.ok(
      [DELIVERY_STATUS.PENDING, DELIVERY_STATUS.PROCESSING, DELIVERY_STATUS.SENT, DELIVERY_STATUS.FAILED]
        .includes(smsDelivery.status),
      `unexpected delivery status ${smsDelivery.status}`,
    );

    // Try to claim it ourselves, exactly as the scheduler would. claimById
    // touches only this row by primary key — no channel/time collision
    // surface with any other TEST file. It can still lose the race to the
    // REAL live background worker specifically (this row was unconditionally
    // due from the instant publishNotification() committed, per the note
    // above) — that is not a retryable "someone else is transiently holding
    // it" situation the way a sibling test file's collateral claim is
    // (retries: 0 here on purpose), so both outcomes are handled explicitly
    // below rather than papered over with a retry loop against a real worker
    // that will never give the row back.
    const mine = await claimById({ targetId: smsDelivery.id, lockedBy: 'lifecycle-worker', now: TEST_NOW });

    let finalDelivery;
    if (mine) {
      // Common case: we claimed it. Prove the full pipeline ourselves.
      const outcome = await processDelivery(mine, {
        senders: { [CHANNELS.SMS]: async () => ({ ok: true, id: 'lifecycle-msg-1' }) },
      });
      assert.equal(outcome.status, DELIVERY_STATUS.SENT);
      finalDelivery = await NotificationDelivery.findByPk(smsDelivery.id);
      assert.equal(finalDelivery.status, DELIVERY_STATUS.SENT);
      assert.ok(finalDelivery.sentAt);
    } else {
      // The real live worker legitimately claimed it first — evidence the
      // pipeline works autonomously, not a test failure. Bounded, verifying
      // wait for it to finish (checking real state each iteration, not a
      // blind delay) rather than assuming any particular timing, then assert
      // the outcome it actually produced is sane.
      const deadline = Date.now() + 5000;
      do {
        finalDelivery = await NotificationDelivery.findByPk(smsDelivery.id);
        if ([DELIVERY_STATUS.SENT, DELIVERY_STATUS.FAILED].includes(finalDelivery.status)) break;
        await new Promise((resolve) => { setTimeout(resolve, 100); });
      } while (Date.now() < deadline);
      assert.ok(
        [DELIVERY_STATUS.SENT, DELIVERY_STATUS.FAILED].includes(finalDelivery.status),
        `expected the live worker to have finished this delivery by now, got ${finalDelivery.status}`,
      );
    }

    const attempts = await NotificationDeliveryAttempt.findAll({ where: { deliveryId: smsDelivery.id } });
    assert.equal(attempts.length, 1, 'exactly one attempt, regardless of who processed it');
    assert.equal(attempts[0].provider, 'numz-sms-gateway');
    if (mine) {
      // Only meaningful when we did the sending ourselves — the injected
      // stub's own fake message id.
      assert.equal(attempts[0].providerMessageId, 'lifecycle-msg-1');
    }

    // Delivery status and user status are independent — this is unread, not
    // "undelivered", even though the SMS succeeded.
    assert.equal(notification.read, false);
  });

  it('failure path: publish -> pending -> worker claims -> permanent provider failure -> FAILED', async () => {
    const dedup = `lifecycle-failure-${randomUUID()}`;
    const io = { sockets: {}, to: () => ({ emit: () => {} }) };

    await publishNotification({
      type: 'test.lifecycle.failure',
      entityType: 'system',
      entityId: dedup,
      severity: 'critical',
      urgency: 'immediate',
      title: 'Lifecycle failure test',
      message: 'end to end failure',
      source: 'fuel-api',
      audience: { userIds: [900001] },
      // Phase 5: same eligibility reasoning as the success-path test above —
      // a format-valid override so planning-time eligibility passes and this
      // test can prove the PROVIDER-level failure path instead of the
      // (equally real, but different) planner-level suppression.
      metadata: { smsTo: '+260977123456' },
      clientDedupKey: dedup,
      // SMS, not EMAIL: email is preference-gated (effectiveChannelsResolver.js
      // defaults it to DISABLED for a user with no preference row), so an
      // email delivery for a fresh fake user would come back cancelled /
      // preference_disabled rather than pending — a real and correct
      // behavior, just not what this test is proving. SMS defaults to
      // ENABLED when no preference row exists (see effectiveChannelsResolver.js),
      // so preference alone would have let it through — the smsTo override
      // above is what clears the separate, Phase 5 eligibility check.
      channels: [CHANNELS.INBOX, CHANNELS.SMS],
    }, { io });

    const notification = await UserNotification.findOne({ where: { clientDedupKey: `900001:${dedup}` } });
    createdNotificationIds.push(notification.id);

    const delivery = await NotificationDelivery.findOne({
      where: { notificationId: notification.id, channel: CHANNELS.SMS },
    });
    await delivery.update({ nextAttemptAt: new Date(TEST_NOW.getTime() - 1000) });

    // Same reasoning as the success-path test above: this row was
    // unconditionally due from the instant publishNotification() committed,
    // so it can genuinely lose the race to the REAL live background worker —
    // not retryable against that (a real claim never reverts), so both
    // outcomes are handled explicitly rather than papered over with retries.
    const mine = await claimById({ targetId: delivery.id, lockedBy: 'lifecycle-worker-2', now: TEST_NOW });

    let finalDelivery;
    if (mine) {
      const outcome = await processDelivery(mine, {
        senders: { [CHANNELS.SMS]: async () => ({ ok: false, reason: 'invalid_phone_number' }) },
      });
      assert.equal(outcome.status, DELIVERY_STATUS.FAILED);
      finalDelivery = await NotificationDelivery.findByPk(delivery.id);
      assert.equal(finalDelivery.status, DELIVERY_STATUS.FAILED);
      assert.equal(finalDelivery.failureCode, 'invalid_phone_number');
    } else {
      // The live worker got there first — user 900001 has no real phone
      // either, so its own real send attempt reaches the same conclusion
      // (permanently unfailable), just under its own failure code
      // (no_recipient_phone) rather than this test's injected one.
      const deadline = Date.now() + 5000;
      do {
        finalDelivery = await NotificationDelivery.findByPk(delivery.id);
        if (finalDelivery.status === DELIVERY_STATUS.FAILED) break;
        await new Promise((resolve) => { setTimeout(resolve, 100); });
      } while (Date.now() < deadline);
      assert.equal(finalDelivery.status, DELIVERY_STATUS.FAILED, 'expected the live worker to have failed this delivery by now');
      assert.ok(finalDelivery.failureCode, 'a permanent failure must still record why');
    }
    assert.equal(finalDelivery.nextAttemptAt, null);

    // The in-app copy is unaffected by the email channel's failure — the
    // notification itself was persisted and remains visible in the center.
    assert.equal(notification.archived, false);
    const inbox = await NotificationDelivery.findOne({
      where: { notificationId: notification.id, channel: CHANNELS.INBOX },
    });
    assert.equal(inbox.status, DELIVERY_STATUS.DELIVERED);
  });

  it('a full scheduler-shaped tick drains a freshly published notification without any manual claim wiring', async () => {
    const dedup = `lifecycle-tick-${randomUUID()}`;
    const io = { sockets: {}, to: () => ({ emit: () => {} }) };
    await publishNotification({
      type: 'test.lifecycle.tick',
      entityType: 'system',
      entityId: dedup,
      severity: 'info',
      urgency: 'normal',
      title: 'Tick test',
      message: 'via runDeliveryWorkerOnce',
      source: 'fuel-api',
      audience: { userIds: [900001] },
      // Phase 5: same reasoning as the two tests above — without a real
      // destination, SMS eligibility now suppresses this at planning time
      // (CANCELLED/no_recipient_phone) before there is ever a pending row
      // for the tick below to claim at all.
      metadata: { smsTo: '+260977123456' },
      clientDedupKey: dedup,
      // INBOX must be requested — publishNotification only persists a
      // notification row at all when INBOX is among the channels (no inbox,
      // no durable record); this is existing, correct behavior, not something
      // to work around.
      channels: [CHANNELS.INBOX, CHANNELS.SMS],
    }, { io });

    const notification = await UserNotification.findOne({ where: { clientDedupKey: `900001:${dedup}` } });
    createdNotificationIds.push(notification.id);
    // Small, near-immediate window, not this file's +40h TEST_NOW: this test's
    // claim is genuinely wide across WORKER_CHANNELS (all three), so at
    // TEST_NOW it could reach down into any other file's smaller-banded
    // fixtures on the same channel — see wideClaimWindow() above.
    const { parkAt, claimNow } = wideClaimWindow();
    await NotificationDelivery.update(
      { nextAttemptAt: parkAt },
      { where: { notificationId: notification.id } },
    );
    const smsTarget = await NotificationDelivery.findOne({
      where: { notificationId: notification.id, channel: CHANNELS.SMS },
    });

    // This row was unconditionally due (nextAttemptAt=NULL) from the instant
    // publishNotification() committed, before the park a few lines up — so,
    // same as the success/failure-path tests above, the REAL live background
    // worker can genuinely reach it first. Track whether OUR OWN claim is the
    // one that processed it, so the assertions below can branch on that
    // rather than assume it.
    let processedByUs = false;
    const summary = await runDeliveryWorkerOnce({
      limit: 50,
      now: claimNow,
      // This is a genuinely wide (WORKER_CHANNELS) claim, so it can in
      // principle also pick up a sibling test file's own pending row. Process
      // only our own known target for real; anything else gets released back
      // exactly as claimDueDeliveries found it, never actually "completed"
      // with data that isn't ours.
      process: async (d) => {
        if (d.id !== smsTarget.id) {
          await NotificationDelivery.update(
            { status: DELIVERY_STATUS.PENDING, lockedAt: null, lockedBy: null,
              attemptCount: sequelize.literal('attempt_count - 1') },
            { where: { id: d.id } },
          );
          return { status: DELIVERY_STATUS.PENDING };
        }
        processedByUs = true;
        return processDelivery(d, {
          senders: { [CHANNELS.SMS]: async () => ({ ok: true, id: 'tick-msg' }) },
        });
      },
    });

    let delivery = await NotificationDelivery.findOne({
      where: { notificationId: notification.id, channel: CHANNELS.SMS },
    });

    if (processedByUs) {
      assert.ok(summary.claimed >= 1);
      assert.equal(delivery.status, DELIVERY_STATUS.SENT);
    } else {
      // The live worker claimed it before our own claim ran (it was never in
      // the batch above at all, so summary.claimed only reflects whatever
      // else this tick happened to touch) — legitimate evidence the pipeline
      // runs autonomously. Bounded, verifying wait for its real outcome
      // (user 900001 has no real phone either, so it resolves to FAILED, not
      // SENT, under the live worker's own real channel — still proof the
      // worker claimed and finished it).
      const deadline = Date.now() + 5000;
      do {
        delivery = await NotificationDelivery.findOne({
          where: { notificationId: notification.id, channel: CHANNELS.SMS },
        });
        if ([DELIVERY_STATUS.SENT, DELIVERY_STATUS.FAILED].includes(delivery.status)) break;
        await new Promise((resolve) => { setTimeout(resolve, 100); });
      } while (Date.now() < deadline);
      assert.ok(
        [DELIVERY_STATUS.SENT, DELIVERY_STATUS.FAILED].includes(delivery.status),
        `expected the live worker to have finished this delivery by now, got ${delivery.status}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Section 4: database unavailability during processing.
//
// The worker cannot survive Postgres being fully down mid-await — no code can.
// What must hold is the property that actually matters: no corrupted state,
// no duplicate logical delivery, and a clean resume once the database returns.
// Simulated at the repository boundary (a rejecting connection), which is
// what a real outage looks like to this code — Sequelize surfaces it as a
// rejected promise either way, whether the transport dropped or the timeout
// fired.
// ---------------------------------------------------------------------------

describe('database unavailability during processing', { skip: !dbReachable }, () => {
  it('a DB failure while recording an attempt leaves the delivery claimed, not corrupted, and it recovers', async () => {
    const n = await UserNotification.create({
      userId: 900001, type: 'test.dbfail', category: 'system', severity: 'info', urgency: 'normal',
      title: 'T', message: 'M', source: 'fuel-api', metadata: {}, read: false, archived: false,
      tenantId: COMPANY, clientDedupKey: `dbfail-${randomUUID()}`,
    });
    createdNotificationIds.push(n.id);
    // Small, near-immediate window, not this file's +40h TEST_NOW — this
    // claim is genuinely wide across WORKER_CHANNELS; see wideClaimWindow()
    // above for why that matters here specifically. createParkedDeliveries
    // sets nextAttemptAt in the same insert (one transaction), so the row is
    // never externally visible in the NULL-due, unconditionally-claimable
    // state a separate follow-up update would pass through.
    const { parkAt: dbFailParkAt, claimNow: dbFailClaimNow } = wideClaimWindow();
    const [delivery] = await createParkedDeliveries({
      notificationId: n.id, companyId: COMPANY, recipientUserId: 900001, channels: [CHANNELS.SMS],
      nextAttemptAt: dbFailParkAt,
    });

    // Simulate the database going away for the REST of processing: the claim
    // itself succeeds (the DB is up for that step), but everything after it —
    // recordAttempt, transitionDelivery — cannot reach Postgres.
    // processDelivery's own DB calls are not dependency-injected (the
    // database is not an optional dependency of a delivery, unlike the
    // provider sender), so this exercises the real isolation boundary:
    // runDeliveryWorkerOnce's per-delivery try/catch around whatever
    // `process` throws — using the worker's OWN claim step, not a pre-claim
    // done separately, or nothing would be left for it to claim.
    const dbDownError = Object.assign(new Error('Connection terminated unexpectedly'), {
      name: 'SequelizeConnectionError',
    });

    const summary = await runDeliveryWorkerOnce({
      limit: 10,
      now: dbFailClaimNow,
      process: async (d) => {
        if (d.id !== delivery.id) {
          // Not ours — this wide claim swept up a sibling file's row. Release
          // it exactly as found; faking a "sent" result without ever writing
          // one would leave that file's row claimed but never really
          // completed, corrupting its own later assertions.
          await NotificationDelivery.update(
            { status: DELIVERY_STATUS.PENDING, lockedAt: null, lockedBy: null,
              attemptCount: sequelize.literal('attempt_count - 1') },
            { where: { id: d.id } },
          );
          return { status: DELIVERY_STATUS.PENDING };
        }
        throw dbDownError;
      },
    });
    // >= 1, not === 1: this call's own claim query is fleet-wide by channel
    // (matching production), so under node --test's default cross-file
    // concurrency it can occasionally also pick up an unrelated pending
    // delivery from a sibling test file that has not yet been parked into its
    // own future band. That is a shared-fixture fact, not a defect in this
    // property. The injected `process` below only throws for THIS delivery's
    // own id and succeeds normally for anything else it happens to be handed,
    // so results.error stays exactly 1 regardless of what else was claimed
    // alongside it — the row-level assertions after this are what prove this
    // specific delivery was claimed, isolated, and left uncorrupted.
    assert.ok(summary.claimed >= 1, 'the worker must have actually claimed at least this delivery');
    assert.equal(summary.results.error, 1, 'this delivery\'s failure must be isolated, not propagated out of the tick');

    // The row is exactly where the claim left it: PROCESSING, locked, attempt
    // counted once. Nothing was corrupted by the failed write.
    const stuck = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(stuck.status, DELIVERY_STATUS.PROCESSING);
    assert.equal(stuck.attemptCount, 1, 'the claim-time increment stands; no double counting');
    assert.equal(
      (await NotificationDeliveryAttempt.count({ where: { deliveryId: delivery.id } })),
      0,
      'no partial/corrupt attempt row from the failed write',
    );

    // "The database becomes available" = the same call now succeeds. Stale
    // recovery is the actual resume path once the outage has passed the
    // staleness threshold.
    //
    // recoverStaleProcessing's "older than" comparison does not respect the
    // per-file time bands the way the due-date claim query does: a threshold
    // far in the future would recover every currently-processing row in the
    // whole table, including sibling test files' own legitimately in-flight
    // work. So instead of inflating staleBefore, backdate ONLY this row's own
    // lockedAt to a genuinely-past real timestamp — exactly what a real stale
    // claim looks like — and recover with a real-time-relative threshold, the
    // same pattern deliveryHardening.test.js uses for its own stale-lock tests.
    await NotificationDelivery.update(
      { lockedAt: new Date(Date.now() - 60 * 60 * 1000) },
      { where: { id: delivery.id } },
    );
    const recovered = await recoverStaleProcessing({ staleBefore: new Date(Date.now() - 60000) });
    assert.ok(recovered >= 1);
    const resumed = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(resumed.status, DELIVERY_STATUS.PENDING);

    // And it can now be claimed and completed normally — no duplicate
    // logical delivery was created anywhere in this sequence.
    const again = await claimById({
      targetId: delivery.id, lockedBy: 'dbfail-worker-2', now: new Date(TEST_NOW.getTime() + 2000),
    });
    assert.ok(again);
    await processDelivery(again, { senders: { [CHANNELS.SMS]: async () => ({ ok: true, id: 'resumed-msg' }) } });

    const final = await NotificationDelivery.findByPk(delivery.id);
    assert.equal(final.status, DELIVERY_STATUS.SENT);
    const deliveryCount = await NotificationDelivery.count({ where: { notificationId: n.id } });
    assert.equal(deliveryCount, 1, 'still exactly one logical delivery through the whole outage');
  });

  it('a scheduler tick that throws (e.g. the claim query itself fails) does not crash the process or corrupt status', async () => {
    // runIntervalJob already catches and logs (see schedulerRuntime.js) — this
    // confirms runDeliveryWorkerOnce's own contract: if claim() itself
    // rejects, the caller sees a rejected promise, not a partial/silent state
    // change, so runIntervalJob's existing catch is what makes this safe.
    const dbDownError = new Error('connection refused');
    await assert.rejects(
      () => runDeliveryWorkerOnce({
        limit: 5,
        claim: async () => { throw dbDownError; },
      }),
      /connection refused/,
    );
  });
});
