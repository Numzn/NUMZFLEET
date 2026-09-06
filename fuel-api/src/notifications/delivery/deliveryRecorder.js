import { CHANNELS } from '../contracts/notificationContract.js';
import { DELIVERY_STATUS } from './deliveryStates.js';
import {
  createDeliveriesForNotification,
  recordAttempt,
  transitionDelivery,
  markAttempted,
} from './deliveryRepository.js';

/**
 * Turns what the synchronous dispatcher actually did into durable records.
 *
 * Phase 2 deliberately records rather than controls: the existing dispatch path
 * is untouched and still decides what gets sent. This module only writes down
 * the outcome, so nothing here can introduce a duplicate SMS or push.
 *
 * Which provider backs each channel. Kept here rather than inside the channels
 * so the domain records a provider name without importing provider modules.
 */
const CHANNEL_PROVIDER = Object.freeze({
  [CHANNELS.PUSH]: 'web-push',
  [CHANNELS.SMS]: 'numz-sms-gateway',
  [CHANNELS.EMAIL]: 'smtp',
  [CHANNELS.WEBSOCKET]: 'socket.io',
  [CHANNELS.INBOX]: 'postgres',
});

/**
 * Human-readable elaboration for each machine-readable planning reason —
 * failure_code stays the stable, structured value a caller/query can key on;
 * this is only ever the accompanying failure_reason text. Reused verbatim
 * from Phase 2's original single reason (preference_disabled) plus the
 * planner's Phase 5 additions — kept here, not in the planner, so the
 * planner's own output stays plain data (channel/decision/reason) with no
 * opinion about display text.
 */
const REASON_TEXT = Object.freeze({
  preference_disabled: 'Recipient has this channel disabled for this category',
  no_recipient_phone: 'No phone number on file for this recipient',
  invalid_phone_number: 'The phone number on file could not be normalized',
  no_recipient_email: 'No email address on file for this recipient',
  invalid_email_address: 'The email address on file is not a real deliverable address',
  no_recipient: 'Recipient has no linked account for this channel',
  no_subscriptions: 'Recipient has no registered push subscriptions',
  tenant_mismatch: "Recipient's home company does not match this notification's company",
  recipient_inactive: 'Recipient account is not active',
  quiet_hours_delayed: 'Held until the configured quiet-hours window ends',
  unknown_channel: 'Unrecognized channel',
});

/**
 * Create the delivery rows for one persisted notification, from the delivery
 * planner's per-channel plan (see notifications/planner/deliveryPlanner.js).
 *
 * Groups channels by their exact resulting row shape (status/failureCode/
 * failureReason/nextAttemptAt) so each distinct outcome is one INSERT rather
 * than one round trip per channel — a notification with 3 channels that all
 * plan to 'deliver' is still a single call, same as before Phase 5.
 *
 * @param {{ notificationId: string, companyId: string, recipientUserId: number,
 *   plan: Array<{ channel: string, decision: 'deliver'|'suppress'|'delay',
 *     reason?: string, nextAttemptAt?: Date, overrideNote?: string|null }> }} spec
 */
export async function recordPlannedDeliveries({
  notificationId,
  companyId,
  recipientUserId,
  plan,
}) {
  const groups = new Map();
  for (const entry of plan) {
    const status = entry.decision === 'deliver' ? DELIVERY_STATUS.PENDING
      : entry.decision === 'delay' ? DELIVERY_STATUS.PENDING
        : DELIVERY_STATUS.CANCELLED;
    const failureCode = entry.decision === 'deliver' ? null : entry.reason;
    const failureReason = entry.decision === 'deliver'
      ? (entry.overrideNote || null)
      : (REASON_TEXT[entry.reason] || entry.reason || null);
    // nextAttemptAt is part of the row's identity for grouping purposes even
    // though it's a Date: every 'delay' entry in one planDeliveries() call
    // shares the exact same computed instant (quietHoursEndAfter(now) is
    // evaluated once per call, not per channel), so this still collapses to
    // one group in practice, not one per channel.
    const nextAttemptAt = entry.decision === 'delay' ? (entry.nextAttemptAt || null) : null;
    const key = JSON.stringify([status, failureCode, failureReason, nextAttemptAt?.getTime() ?? null]);
    if (!groups.has(key)) {
      groups.set(key, { status, failureCode, failureReason, nextAttemptAt, channels: [] });
    }
    groups.get(key).channels.push(entry.channel);
  }

  const created = [];
  for (const group of groups.values()) {
    // eslint-disable-next-line no-await-in-loop -- typically 1-3 groups for one recipient; sequential keeps this readable and each group's rows returned in order.
    const rows = await createDeliveriesForNotification({
      notificationId,
      companyId,
      recipientUserId,
      channels: group.channels,
      status: group.status,
      failureCode: group.failureCode,
      failureReason: group.failureReason,
      nextAttemptAt: group.nextAttemptAt,
    });
    created.push(...rows);
  }

  return created;
}

/**
 * The inbox row IS the in-app delivery — if the notification persisted, it was
 * delivered. This is the only channel that can honestly reach 'delivered'
 * today; push, SMS and email have no delivery receipt available.
 */
export async function recordInboxDelivered(deliveries) {
  const inbox = deliveries.find((d) => d.channel === CHANNELS.INBOX);
  if (!inbox || inbox.status !== DELIVERY_STATUS.PENDING) return;

  await markAttempted(inbox);
  await recordAttempt({
    delivery: inbox,
    attemptNumber: 1,
    status: DELIVERY_STATUS.DELIVERED,
    provider: CHANNEL_PROVIDER[CHANNELS.INBOX],
  });
  await transitionDelivery(inbox, DELIVERY_STATUS.DELIVERED);
}

/**
 * Record the outcome of one dispatched channel.
 *
 * Push is the shape that justifies the attempts table: its result carries one
 * entry per registered device, so a single logical push delivery gets several
 * attempts — one per subscription — rather than becoming several notifications.
 */
export async function recordDispatchResult(delivery, result) {
  if (!delivery || delivery.status !== DELIVERY_STATUS.PENDING) return;

  const provider = CHANNEL_PROVIDER[delivery.channel] || null;
  await markAttempted(delivery);

  if (delivery.channel === CHANNELS.PUSH && Array.isArray(result?.results)) {
    let attemptNumber = 0;
    for (const perDevice of result.results) {
      attemptNumber += 1;
      await recordAttempt({
        delivery,
        targetType: 'push_subscription',
        targetId: perDevice.id || null,
        attemptNumber,
        status: perDevice.ok ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED,
        provider,
        failureCode: perDevice.ok ? null : (perDevice.reason || 'send_failed'),
        failureReason: perDevice.ok ? null : (perDevice.error || perDevice.reason || null),
      });
    }
    // The logical delivery succeeded if any device took it.
    await transitionDelivery(
      delivery,
      result.ok ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED,
      result.ok ? {} : { failureCode: result.reason || 'send_failed' },
    );
    return;
  }

  const ok = Boolean(result?.ok);
  await recordAttempt({
    delivery,
    attemptNumber: 1,
    status: ok ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED,
    provider,
    providerMessageId: ok ? (result.id ?? null) : null,
    failureCode: ok ? null : (result?.reason || 'send_failed'),
    failureReason: ok ? null : (result?.error || result?.reason || null),
  });

  await transitionDelivery(
    delivery,
    ok ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED,
    ok ? {} : { failureCode: result?.reason || 'send_failed' },
  );
}

export { CHANNEL_PROVIDER };
