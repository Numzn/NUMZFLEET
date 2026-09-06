import { Op } from 'sequelize';
import { UserNotification } from '../../models/index.js';
import { CHANNELS, URGENCY } from '../contracts/notificationContract.js';
import { publishNotification } from '../orchestrator/publishNotification.js';
import { getNotificationIo } from '../notificationContext.js';

const ALL_CHANNELS = [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.PUSH, CHANNELS.SMS, CHANNELS.EMAIL];

// A single global default, not per-policy — Phase 7 deliberately keeps one
// knob rather than letting every policy define its own timeout. 10 minutes:
// long enough that a human had a real chance to see and acknowledge it,
// short enough to still matter for a mandatory + immediate-urgency event.
// Env-overridable at the scheduler layer (notificationEscalationScheduler.js).
const DEFAULT_ESCALATE_AFTER_MS = 10 * 60 * 1000;

/**
 * Notifications eligible for automatic escalation: mandatory, immediate
 * urgency, never acknowledged, never already escalated, and older than the
 * threshold. Backed by the partial index added in
 * 20260906_notification_escalation.sql — every clause here matches that
 * index's WHERE exactly except the age cutoff, which the index leaves to the
 * query (a fixed threshold in the index itself would bake the env var into
 * the schema).
 *
 * @param {{ limit?: number, escalateAfterMs?: number, now?: Date }} [opts]
 */
export async function findEscalationCandidates({
  limit = 20,
  escalateAfterMs = DEFAULT_ESCALATE_AFTER_MS,
  now = new Date(),
} = {}) {
  const staleBefore = new Date(now.getTime() - escalateAfterMs);
  return UserNotification.findAll({
    where: {
      mandatory: true,
      urgency: URGENCY.IMMEDIATE,
      acknowledgedAt: null,
      escalatedAt: null,
      createdAt: { [Op.lt]: staleBefore },
    },
    order: [['createdAt', 'ASC']],
    limit,
  });
}

/**
 * Escalate one overdue notification: re-notify the same recipient via every
 * channel, once, bypassing the same preference/quiet-hours gates `mandatory`
 * already bypasses at normal publish time — this reuses that exact Phase 5
 * mechanism rather than inventing a second "force delivery" path. Channel
 * eligibility (no phone, no push subscription, ...) is never bypassed, same
 * as any other mandatory notification.
 *
 * The reminder is a new, distinct notification (its own row, its own
 * deliveries) referencing the original via `metadata.escalationOf` — not a
 * re-delivery of the original row — so it shows up as its own inbox entry
 * and the original's own delivery/audit trail is untouched.
 *
 * @param {import('../../models/UserNotification.js').default} original a
 *   live UserNotification Sequelize instance (as returned by
 *   findEscalationCandidates), not the toApi() shape.
 */
export async function escalateNotification(original) {
  const reminderDedupKey = `escalation:${original.id}`;

  await publishNotification({
    type: `${original.type}.escalation`,
    entityType: original.category,
    entityId: original.id,
    severity: original.severity,
    urgency: URGENCY.IMMEDIATE,
    title: `Reminder: ${original.title}`,
    message: `${original.message} — still requires your acknowledgement.`,
    source: original.source,
    companyId: original.tenantId,
    audience: { userIds: [original.userId] },
    metadata: {
      ...(original.metadata || {}),
      escalationOf: original.id,
      escalationReason: 'unacknowledged_mandatory_notification',
    },
    clientDedupKey: reminderDedupKey,
    channels: ALL_CHANNELS,
    mandatory: true,
  }, { io: getNotificationIo() });

  const now = new Date();

  // The reminder row itself is mandatory + immediate + unacknowledged at
  // birth — exactly the shape findEscalationCandidates() looks for. Without
  // this it would become a candidate for its own future escalation once it
  // goes stale, chaining reminders-of-reminders forever. Pre-marking it
  // escalated here does not affect its delivery: mandatory was already
  // consumed for planning inside publishNotification() above, and that
  // publish call already persisted mandatory=true on this same row — this
  // only adds escalated_at, which the escalation query treats as "already
  // handled".
  await UserNotification.update(
    { escalatedAt: now },
    { where: { userId: original.userId, clientDedupKey: `${original.userId}:${reminderDedupKey}` } },
  );

  await original.update({ escalatedAt: now });
}

/**
 * Batch entry point for the scheduler: find candidates, escalate each,
 * one failure does not block the rest of the batch (same shape as
 * smsReconciliation.js's reconcileStaleSmsDeliveries).
 *
 * @param {{ limit?: number, escalateAfterMs?: number, now?: Date }} [opts]
 * @param {{ escalate?: typeof escalateNotification }} [deps] Injection seam
 *   for tests only — every real call site uses the default.
 */
export async function escalateOverdueNotifications({
  limit = 20,
  escalateAfterMs = DEFAULT_ESCALATE_AFTER_MS,
  now = new Date(),
} = {}, deps = {}) {
  const escalate = deps.escalate || escalateNotification;
  const candidates = await findEscalationCandidates({ limit, escalateAfterMs, now });

  let escalated = 0;
  let errors = 0;
  for (const original of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop -- a bounded batch of escalations, each independent; not worth a Promise.all's partial-failure complexity here.
      await escalate(original);
      escalated += 1;
    } catch (error) {
      errors += 1;
      console.error('[notification-escalation] failed to escalate', {
        notificationId: original.id,
        error: error?.message || error,
      });
    }
  }

  return { checked: candidates.length, escalated, errors };
}
