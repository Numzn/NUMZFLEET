import { QueryTypes } from 'sequelize';
import sequelize, { NotificationDelivery } from '../../models/index.js';
import { claimDueDeliveries } from './deliveryRepository.js';
import { DELIVERY_STATUS, CLAIMABLE_STATUSES } from './deliveryStates.js';

/**
 * Deterministic, test-only claim of ONE already-known delivery, by its own
 * primary key. Touches exactly that row and nothing else — no channel scan,
 * no collateral, no cross-file surface at all.
 *
 * This exists because most tests already know exactly which delivery they
 * created and just need it moved into 'processing' so they can exercise
 * whatever comes after (processDelivery, a state assertion, etc.). Routing
 * that through the real claimDueDeliveries() — which claims by channel and
 * due-time, matching a production worker that has no idea which test created
 * what — used to mean a sibling test file's own wide claim could transiently
 * hold this exact row (claim-it-as-collateral-then-release-it), and if this
 * claim landed inside that window it found nothing. That was a real,
 * reproduced race (see the root-cause note in deliveryWorker.test.js), not a
 * production defect: FOR UPDATE SKIP LOCKED and the rest of
 * claimDueDeliveries are correct for what a real worker needs. The fix is
 * that most tests don't need that query's discovery behavior at all — only
 * the handful that are actually testing discovery/concurrency do, and those
 * keep using the real function (see below).
 *
 * Reuses the identical statement shape as production's own claim (same SET
 * list, same FOR UPDATE SKIP LOCKED, same outer status re-check) so this is
 * still exercising real claim semantics for one row, not a fake stand-in.
 *
 * `retries` exists for exactly one situation: a target row was created via
 * the real, unfaced publishNotification() (proving the actual business-event
 * path, not a test fixture) and so briefly existed with nextAttemptAt=NULL —
 * always-due — before this test parked it. In that narrow window the live
 * background worker (real-time, has no concept of test bands) or a sibling
 * file's own genuinely-wide discovery test on the same channel could
 * transiently claim it first. A short retry rides that out rather than
 * reporting a false "not found". Every other caller creates rows through
 * test-only fixtures that park them immediately and passes retries: 0 (the
 * default), so a genuine miss still fails fast.
 *
 * @returns {Promise<object|null>} the claimed row, or null if it was not
 *   actually claimable (wrong status, not yet due) after all attempts — a
 *   genuine miss, not a race, so callers should treat null as a real
 *   assertion failure.
 */
export async function claimById({ targetId, lockedBy, now = new Date(), retries = 0 }) {
  if (!targetId) throw new Error('[test-helpers] targetId is required');
  if (!lockedBy) throw new Error('[test-helpers] lockedBy is required');

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const rows = await sequelize.query(
      `
      UPDATE notification_deliveries
         SET status = :processing,
             locked_at = :now,
             locked_by = :lockedBy,
             attempt_count = attempt_count + 1,
             last_attempt_at = :now,
             updated_at = :now
       WHERE id = :targetId
         AND status IN (:claimable)
         AND (next_attempt_at IS NULL OR next_attempt_at <= :now)
       RETURNING id
      `,
      {
        replacements: {
          processing: DELIVERY_STATUS.PROCESSING,
          claimable: CLAIMABLE_STATUSES,
          targetId,
          now,
          lockedBy,
        },
        type: QueryTypes.SELECT,
      },
    );

    if (rows.length) return NotificationDelivery.findByPk(targetId);
    if (attempt < retries) await new Promise((resolve) => { setTimeout(resolve, 50); });
  }
  return null;
}

/**
 * Same as claimById, for the handful of tests that legitimately need several
 * known deliveries claimed in one pass (e.g. proving one recipient's failure
 * doesn't block another's). Still touches only the listed ids — nothing else.
 *
 * @returns {Promise<Map<string, object>>} targetId -> claimed row, for every
 *   target actually claimed (missing ids are simply absent from the map)
 */
export async function claimByIds({ targetIds, lockedBy, now = new Date() }) {
  if (!Array.isArray(targetIds) || !targetIds.length) return new Map();
  if (!lockedBy) throw new Error('[test-helpers] lockedBy is required');

  const rows = await sequelize.query(
    `
    UPDATE notification_deliveries
       SET status = :processing,
           locked_at = :now,
           locked_by = :lockedBy,
           attempt_count = attempt_count + 1,
           last_attempt_at = :now,
           updated_at = :now
     WHERE id IN (:targetIds)
       AND status IN (:claimable)
       AND (next_attempt_at IS NULL OR next_attempt_at <= :now)
     RETURNING id
    `,
    {
      replacements: {
        processing: DELIVERY_STATUS.PROCESSING,
        claimable: CLAIMABLE_STATUSES,
        targetIds,
        now,
        lockedBy,
      },
      type: QueryTypes.SELECT,
    },
  );

  const claimedIds = rows.map((r) => r.id);
  if (!claimedIds.length) return new Map();

  const claimed = await NotificationDelivery.findAll({ where: { id: claimedIds } });
  return new Map(claimed.map((d) => [d.id, d]));
}

/**
 * Creates delivery rows with their FINAL state (status, nextAttemptAt, and
 * any other overrides) already set in the same INSERT — never transiently
 * 'pending' with nextAttemptAt=NULL (unconditionally due for ANY claimer,
 * live background worker included) before some separate follow-up UPDATE
 * parks it into the future.
 *
 * This exists because createDeliveriesForNotification() (production) always
 * creates NULL-due rows — correctly, a real fresh delivery should be
 * immediately claimable — so every test fixture that used to call it and
 * THEN issue a separate `.update({ nextAttemptAt })` had a real, if brief,
 * window where a concurrent wide claim (the live background worker, or a
 * sibling file's own genuinely-wide-claim test) could legitimately claim it
 * first, exactly like the collateral race documented in deliveryWorker.test.js's
 * ROOT CAUSE note. Wrapping creation and parking in ONE transaction closes
 * that window structurally rather than by timing: under READ COMMITTED, a
 * concurrent claim query (its own transaction) can only ever observe "row
 * does not exist yet" or "row exists, already in its final parked state" —
 * the intermediate always-due state is never externally visible.
 *
 * Not a replacement for createDeliveriesForNotification in production code —
 * this inlines the same row shape purely so tests can set nextAttemptAt (and
 * optionally other fields, e.g. a pre-backdated lockedAt for a stale-lock
 * fixture) atomically at creation. Production correctly does not expose that
 * knob: a real caller never wants a pre-parked delivery.
 *
 * The couple of tests that exercise the real, unfaced publishNotification()
 * entrypoint (deliveryLifecycle.test.js's "complete lifecycle" tests) cannot
 * use this — there is no way to interpose on publishNotification()'s own
 * internal transaction from outside it. Channel exclusivity is what protects
 * those instead (see that file's own notes).
 *
 * @returns {Promise<object[]>} the created rows, ordered by channel
 */
export async function createParkedDeliveries({
  notificationId,
  companyId,
  recipientUserId,
  channels,
  nextAttemptAt,
  status = DELIVERY_STATUS.PENDING,
  overrides = {},
}) {
  if (!notificationId) throw new Error('[test-helpers] notificationId is required');
  if (!companyId) throw new Error('[test-helpers] companyId is required');
  if (!Array.isArray(channels) || !channels.length) return [];

  const now = new Date();
  const rows = channels.map((channel) => ({
    notificationId,
    companyId,
    recipientUserId,
    channel,
    status,
    nextAttemptAt,
    queuedAt: status === DELIVERY_STATUS.PENDING ? now : null,
    ...overrides,
  }));

  return sequelize.transaction(async (transaction) => {
    await NotificationDelivery.bulkCreate(rows, { validate: true, ignoreDuplicates: true, transaction });
    return NotificationDelivery.findAll({
      where: { notificationId, channel: channels },
      order: [['channel', 'ASC']],
      transaction,
    });
  });
}

/**
 * For the small number of tests that are actually ABOUT claimDueDeliveries'
 * discovery behavior — "does a channel-wide claim find pending work",
 * "can two concurrent wide claims double-claim the same row" — claimById
 * would defeat the point: those need the real query. Determinism for THOSE
 * tests comes from a different, fully reliable axis instead of timing:
 * every file that does a genuine wide (not by-id) claim uses its own
 * dedicated channel, so a sibling file's wide claim can never even match its
 * rows in the first place — not "rarely", structurally never, since channel
 * is an exact-match filter with no asymmetry the way a `<=` time comparison
 * has. See WIDE_CLAIM_CHANNEL exports below; each delivery test file that
 * does real wide claiming imports and uses its own.
 *
 * deliveryLifecycle.test.js gets sms, not a free pick: its "complete
 * lifecycle" tests publish through the real, unfaced publishNotification(),
 * and effectiveChannelsResolver.js gates email/push off by default for a
 * fresh recipient with no preference row — only inbox/websocket/sms dispatch
 * unconditionally, and only sms of those is worker-claimed at all (inbox and
 * websocket resolve inline, no claim, no gap to protect). deliveryWorker.test.js
 * and deliveryHardening.test.js create their fixtures directly (bypassing the
 * resolver entirely), so push/email were free to assign between them.
 */
export const WIDE_CLAIM_CHANNELS = Object.freeze({
  DELIVERY_WORKER_TEST: 'push',
  DELIVERY_HARDENING_TEST: 'email',
  DELIVERY_LIFECYCLE_TEST: 'sms',
});

export { claimDueDeliveries };
