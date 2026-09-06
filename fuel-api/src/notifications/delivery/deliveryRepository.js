import { Op, QueryTypes } from 'sequelize';
import sequelize, { NotificationDelivery, NotificationDeliveryAttempt } from '../../models/index.js';
import {
  DELIVERY_STATUS,
  CLAIMABLE_STATUSES,
  assertTransition,
  isTerminal,
  buildAttemptIdempotencyKey,
} from './deliveryStates.js';

/**
 * Persistence for durable delivery records. Phase 2 only writes and reads them;
 * nothing here sends anything or decides retries — that is the Phase 3 worker.
 *
 * Every read is company-scoped by an explicit companyId argument rather than a
 * join up to notifications, because the Phase 3 worker and provider webhooks
 * run outside any HTTP request that could carry req.auth.
 */

/**
 * Create the logical delivery rows for one already-persisted notification.
 * Idempotent: re-publishing a deduplicated notification will not create a
 * second delivery for the same (notification, channel).
 *
 * @param {{ notificationId: string, companyId: string, recipientUserId: number,
 *   channels: string[], status?: string, failureCode?: string|null,
 *   failureReason?: string|null, nextAttemptAt?: Date|null }} spec
 *   `nextAttemptAt` defaults to unset (NULL — unconditionally due), matching
 *   every caller before Phase 5. The delivery planner is the one caller with a
 *   genuine reason to pass it explicitly (a quiet-hours hold): setting it in
 *   THIS insert, rather than a separate follow-up UPDATE, is what keeps the
 *   row from ever being externally visible in the always-due state — a
 *   separate update would reopen exactly the NULL-window race Phase 4 spent
 *   real effort closing on the test side (see deliveryWorker.test.js's ROOT
 *   CAUSE note and __testHelpers.js's createParkedDeliveries). Production
 *   never previously needed this, which is why the parameter did not exist
 *   until a real caller (the planner) did.
 */
export async function createDeliveriesForNotification({
  notificationId,
  companyId,
  recipientUserId,
  channels,
  status = DELIVERY_STATUS.PENDING,
  failureCode = null,
  failureReason = null,
  nextAttemptAt = null,
}) {
  if (!notificationId) throw new Error('[deliveries] notificationId is required');
  if (!companyId) throw new Error('[deliveries] companyId is required');
  if (!Array.isArray(channels) || !channels.length) return [];

  const now = new Date();
  const rows = channels.map((channel) => ({
    notificationId,
    companyId,
    recipientUserId,
    channel,
    status,
    failureCode,
    failureReason,
    nextAttemptAt,
    queuedAt: status === DELIVERY_STATUS.PENDING ? now : null,
  }));

  // ignoreDuplicates leans on UNIQUE(notification_id, channel) — the delivery
  // half of idempotency, distinct from client_dedup_key which stops duplicate
  // logical notifications one level up.
  await NotificationDelivery.bulkCreate(rows, { validate: true, ignoreDuplicates: true });

  return NotificationDelivery.findAll({
    where: { notificationId, channel: { [Op.in]: channels } },
    order: [['channel', 'ASC']],
  });
}

/**
 * Record one physical send against a delivery. Push calls this once per device.
 *
 * @param {{ delivery: object, targetType?: string|null, targetId?: string|null,
 *   attemptNumber?: number, status: string, provider?: string|null,
 *   providerMessageId?: string|null, failureCode?: string|null,
 *   failureReason?: string|null }} spec
 */
export async function recordAttempt({
  delivery,
  targetType = null,
  targetId = null,
  attemptNumber = 1,
  status,
  provider = null,
  providerMessageId = null,
  failureCode = null,
  failureReason = null,
}) {
  if (!delivery?.id) throw new Error('[deliveries] a persisted delivery is required');

  const idempotencyKey = buildAttemptIdempotencyKey(delivery.id, targetId, attemptNumber);
  const now = new Date();

  // findOrCreate keyed on the deterministic idempotency key: replaying the same
  // attempt returns the original row rather than sending twice.
  const [attempt] = await NotificationDeliveryAttempt.findOrCreate({
    where: { idempotencyKey },
    defaults: {
      deliveryId: delivery.id,
      companyId: delivery.companyId,
      attemptNumber,
      targetType,
      targetId,
      idempotencyKey,
      status,
      provider,
      providerMessageId,
      failureCode,
      failureReason,
      startedAt: now,
      completedAt: now,
    },
  });

  return attempt;
}

/**
 * Move a delivery to a new state, refusing transitions that would run backwards
 * or resurrect a terminal row. Timestamps are set from the target state so the
 * lifecycle is readable without reconstructing it from attempts.
 */
export async function transitionDelivery(delivery, toStatus, patch = {}) {
  assertTransition(delivery.status, toStatus);

  const now = new Date();
  const update = { status: toStatus, ...patch };

  if (toStatus === DELIVERY_STATUS.SENT && !delivery.sentAt) update.sentAt = now;
  if (toStatus === DELIVERY_STATUS.DELIVERED && !delivery.deliveredAt) update.deliveredAt = now;
  if (toStatus === DELIVERY_STATUS.FAILED && !delivery.failedAt) update.failedAt = now;
  if (toStatus === DELIVERY_STATUS.EXPIRED && !delivery.failedAt) update.failedAt = now;

  // A delivery that has stopped moving must not keep a lock stamp, or stale
  // recovery would eventually try to rescue something already finished.
  if (toStatus !== DELIVERY_STATUS.PROCESSING) {
    update.lockedAt = null;
    update.lockedBy = null;
  }

  // A settled delivery carries no pending retry. The status filter already
  // makes terminal rows unclaimable; this just stops the row from implying a
  // future attempt that will never happen.
  if (isTerminal(toStatus)) {
    update.nextAttemptAt = null;
  }

  await delivery.update(update);
  return delivery;
}

/** Increment the attempt counter and stamp the attempt time. */
export async function markAttempted(delivery, at = new Date()) {
  await delivery.update({
    attemptCount: (delivery.attemptCount || 0) + 1,
    lastAttemptAt: at,
  });
  return delivery;
}

/**
 * Every delivery for a notification. companyId is required, not optional —
 * a caller that does not know the tenant has no business reading these.
 */
export async function listDeliveriesForNotification(notificationId, companyId) {
  if (!companyId) throw new Error('[deliveries] companyId is required');
  return NotificationDelivery.findAll({
    where: { notificationId, companyId },
    include: [{ model: NotificationDeliveryAttempt, as: 'attempts' }],
    order: [['channel', 'ASC']],
  });
}

/** Attempts for one delivery, oldest first. Company-scoped for the same reason. */
export async function listAttemptsForDelivery(deliveryId, companyId) {
  if (!companyId) throw new Error('[deliveries] companyId is required');
  return NotificationDeliveryAttempt.findAll({
    where: { deliveryId, companyId },
    order: [['attemptNumber', 'ASC']],
  });
}

/**
 * Atomically claim a batch of due deliveries for one worker tick.
 *
 * The UPDATE ... WHERE id IN (SELECT ...) RETURNING form is the claim: a
 * delivery moves to 'processing' and gains a lock stamp in a single statement,
 * so two concurrent callers cannot both take the same row — the second one's
 * subquery no longer matches it. attempt_count is incremented here too, which
 * is what makes the attempt number deterministic and collision-free: the
 * claiming statement, not the worker, decides which attempt this is.
 *
 * runIntervalJob's advisory lock already serialises ticks fleet-wide; this is
 * the second layer, and the one that survives a lock being lost or a future
 * decision to run several workers.
 *
 * `companyId` is optional and normally omitted: the worker is a background
 * process that legitimately serves every tenant. Passing it restricts the claim
 * to one company, which is useful for draining or inspecting a single tenant
 * Deliberately NOT company-scoped: this is a background process, not a
 * request, and claims across every tenant in one pass — the same shape as
 * complianceNotificationScheduler.js's own sweep. Tenant isolation is
 * enforced downstream instead: every row it touches already carries its own
 * companyId (recordAttempt inherits it from the delivery), so an attempt can
 * never be written under the wrong company regardless of claim order.
 *
 * @param {{ channels: string[], limit?: number, lockedBy: string, now?: Date }} opts
 */
export async function claimDueDeliveries({
  channels, limit = 25, lockedBy, now = new Date(),
}) {
  if (!Array.isArray(channels) || !channels.length) return [];
  if (!lockedBy) throw new Error('[deliveries] lockedBy is required to claim work');

  const rows = await sequelize.query(
    `
    UPDATE notification_deliveries
       SET status = :processing,
           locked_at = :now,
           locked_by = :lockedBy,
           attempt_count = attempt_count + 1,
           last_attempt_at = :now,
           updated_at = :now
     WHERE id IN (
       SELECT id FROM notification_deliveries
        WHERE status IN (:claimable)
          AND channel IN (:channels)
          AND (next_attempt_at IS NULL OR next_attempt_at <= :now)
        ORDER BY created_at
        LIMIT :limit
        -- Skip rows another transaction is already claiming instead of queueing
        -- behind their locks. Without this, two concurrent claims serialise on
        -- the row lock rather than diverging.
        FOR UPDATE SKIP LOCKED
     )
       -- Re-stated outside the subquery on purpose. Under READ COMMITTED the
       -- subquery's id list is computed from a snapshot; if a concurrent claim
       -- commits while this statement waits on the row lock, PostgreSQL
       -- re-evaluates only the OUTER predicate against the new row version.
       -- With the status test living solely in the subquery, that re-check
       -- would still pass and the row would be claimed twice.
       AND status IN (:claimable)
       AND (next_attempt_at IS NULL OR next_attempt_at <= :now)
     RETURNING id
    `,
    {
      replacements: {
        processing: DELIVERY_STATUS.PROCESSING,
        claimable: CLAIMABLE_STATUSES,
        channels,
        now,
        lockedBy,
        limit,
      },
      type: QueryTypes.SELECT,
    },
  );

  const ids = (rows || []).map((r) => r.id).filter(Boolean);
  if (!ids.length) return [];
  return NotificationDelivery.findAll({ where: { id: { [Op.in]: ids } } });
}

/**
 * Return deliveries abandoned by a crashed worker to the queue.
 *
 * A row stuck in 'processing' past the stale threshold had its worker die
 * between claiming and recording. attempt_count was already incremented by the
 * claim, so a crash still consumes one attempt and cannot loop forever.
 *
 * @returns {Promise<number>} how many were recovered
 */
export async function recoverStaleProcessing({ staleBefore }) {
  // Sequelize's Model.update resolves to [affectedCount] on Postgres — the
  // second element only exists when `returning` is set. Destructuring the
  // second element yields undefined and silently reports zero recoveries.
  const [affectedCount] = await NotificationDelivery.update(
    {
      status: DELIVERY_STATUS.PENDING,
      lockedAt: null,
      lockedBy: null,
    },
    {
      where: {
        status: DELIVERY_STATUS.PROCESSING,
        lockedAt: { [Op.lt]: staleBefore },
      },
    },
  );
  return typeof affectedCount === 'number' ? affectedCount : 0;
}

/** Park a delivery until next_attempt_at after a transient failure. */
export async function scheduleRetry(delivery, { nextAttemptAt, failureCode, failureReason }) {
  assertTransition(delivery.status, DELIVERY_STATUS.RETRYING);
  await delivery.update({
    status: DELIVERY_STATUS.RETRYING,
    nextAttemptAt,
    failureCode: failureCode || null,
    failureReason: failureReason || null,
    lockedAt: null,
    lockedBy: null,
  });
  return delivery;
}

/**
 * Queue depth for operators. Company-scoped like every other read here — the
 * caller passes the tenant, so this can never leak another company's backlog.
 *
 * Kept out of /health on purpose: this hits the database, and /health is polled
 * by the container probe.
 */
export async function getDeliveryQueueStats(companyId, { now = new Date() } = {}) {
  if (!companyId) throw new Error('[deliveries] companyId is required');

  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const byStatus = await NotificationDelivery.findAll({
    where: { companyId },
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  const counts = {};
  for (const row of byStatus) counts[row.status] = Number(row.count);

  const oldestPending = await NotificationDelivery.findOne({
    where: { companyId, status: { [Op.in]: CLAIMABLE_STATUSES } },
    order: [['created_at', 'ASC']],
    attributes: ['id', 'channel', 'status', 'created_at'],
    raw: true,
  });

  const recentFailures = await NotificationDelivery.count({
    where: {
      companyId,
      status: { [Op.in]: [DELIVERY_STATUS.FAILED, DELIVERY_STATUS.EXPIRED] },
      failedAt: { [Op.gte]: since24h },
    },
  });

  const oldestCreatedAt = oldestPending?.created_at ? new Date(oldestPending.created_at) : null;

  return {
    byStatus: counts,
    pending: counts[DELIVERY_STATUS.PENDING] || 0,
    retrying: counts[DELIVERY_STATUS.RETRYING] || 0,
    processing: counts[DELIVERY_STATUS.PROCESSING] || 0,
    failedOrExpiredLast24h: recentFailures,
    oldestUnsent: oldestPending
      ? {
        channel: oldestPending.channel,
        status: oldestPending.status,
        ageSeconds: Math.round((now.getTime() - oldestCreatedAt.getTime()) / 1000),
      }
      : null,
  };
}

/** Correlate a provider callback back to the attempt that produced it. */
export async function findAttemptByProviderMessage(provider, providerMessageId, companyId) {
  if (!companyId) throw new Error('[deliveries] companyId is required');
  if (!provider || !providerMessageId) return null;
  return NotificationDeliveryAttempt.findOne({
    where: { provider, providerMessageId, companyId },
  });
}
