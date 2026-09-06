import { randomUUID } from 'node:crypto';
import { UserNotification } from '../../models/index.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { toCanonicalPayload } from '../canonicalNotification.js';
import { deliverPushNotification } from '../channels/pushChannel.js';
import { deliverSmsNotification } from '../channels/smsChannel.js';
import { deliverEmailNotification } from '../channels/emailChannel.js';
import { CHANNEL_PROVIDER } from './deliveryRecorder.js';
import { DELIVERY_STATUS } from './deliveryStates.js';
import { classifyFailure, isRetryable, isUncertainOutcome, FAILURE_KIND } from './failureClassifier.js';
import {
  claimDueDeliveries,
  recoverStaleProcessing,
  recordAttempt,
  transitionDelivery,
  scheduleRetry,
} from './deliveryRepository.js';

/**
 * Asynchronous delivery worker.
 *
 * Consumes the durable notification_deliveries rows created at publish time and
 * drives them to a terminal state. It never creates a notification or a logical
 * delivery — a retry re-uses the same delivery row and adds an attempt, so one
 * SMS delivery can never become two.
 *
 * Channel scope is deliberate. Only the external channels are processed here:
 *   - inbox     is delivered by the act of writing the notification row, and is
 *               already marked delivered at creation (Phase 2). There is no
 *               provider to call, so inventing one would be theatre.
 *   - websocket is best-effort realtime, not durable delivery. Its value is
 *               immediacy, and it needs the live socket server handle, so it
 *               stays synchronous in the request path and is recorded there.
 * Neither is ever claimed by this worker.
 */

export const WORKER_CHANNELS = Object.freeze([CHANNELS.PUSH, CHANNELS.SMS, CHANNELS.EMAIL]);

/** Bounded retry policy. Backoff is per-delivery, not global. */
export const MAX_ATTEMPTS = Number(process.env.NOTIFICATION_DELIVERY_MAX_ATTEMPTS || 4);
const BACKOFF_BASE_MS = Number(process.env.NOTIFICATION_DELIVERY_BACKOFF_MS || 60000);
/** A claim older than this is assumed to belong to a worker that died. */
export const STALE_LOCK_MS = Number(process.env.NOTIFICATION_DELIVERY_STALE_MS || 300000);

const CHANNEL_SENDERS = Object.freeze({
  [CHANNELS.PUSH]: deliverPushNotification,
  [CHANNELS.SMS]: deliverSmsNotification,
  [CHANNELS.EMAIL]: deliverEmailNotification,
});

/**
 * Exponential backoff: 1m, 2m, 4m... Bounded by MAX_ATTEMPTS, so this can
 * never become an infinite retry loop.
 */
export function computeNextAttemptAt(attemptCount, now = new Date()) {
  const exponent = Math.max(0, attemptCount - 1);
  const delay = BACKOFF_BASE_MS * (2 ** exponent);
  return new Date(now.getTime() + delay);
}

function log(event, fields) {
  console.log(JSON.stringify({ event: `notification-delivery.${event}`, ...fields, ts: new Date().toISOString() }));
}

/**
 * Aggregate rule for a multi-device push delivery.
 *
 *   any device accepted        -> the delivery is SENT. The user has the
 *                                 notification on at least one device, which is
 *                                 what a push is for; a dead second device does
 *                                 not make that untrue.
 *   every device failed        -> the delivery failed, and the retry decision is
 *                                 taken from the devices themselves:
 *                                   all permanent (e.g. every subscription
 *                                   expired)      -> permanent, do not retry
 *                                   any transient -> retryable
 *   no devices registered      -> permanent 'no_subscriptions'
 *
 * Without this, a fan-out where every subscription was gone would fall through
 * to the classifier with no reason attached and be treated as retryable —
 * burning the retry budget re-discovering that the user has no devices.
 *
 * @returns {{ reason: string, statusCode?: number, expired?: boolean }} a
 *   synthetic failure describing the fan-out as a whole
 */
export function aggregatePushFailure(perDevice) {
  if (!perDevice.length) return { reason: 'no_subscriptions' };

  const failures = perDevice.filter((d) => !d.ok);
  const anyRetryable = failures.some((d) => isRetryable(d));

  if (anyRetryable) {
    const firstRetryable = failures.find((d) => isRetryable(d)) || {};
    return {
      reason: firstRetryable.reason || 'send_failed',
      statusCode: firstRetryable.statusCode,
    };
  }

  // Every device failed permanently — most commonly all subscriptions expired.
  const allExpired = failures.every((d) => d.expired === true || d.reason === 'expired_removed');
  return allExpired
    ? { reason: 'all_subscriptions_expired', expired: true }
    : { reason: failures[0]?.reason || 'send_failed', statusCode: failures[0]?.statusCode };
}

/**
 * Record the outcome of one push fan-out. One attempt row per device, so the
 * multi-device model from Phase 2 is preserved: still ONE logical delivery.
 */
async function recordPushAttempts(delivery, result, attemptNumber) {
  const perDevice = Array.isArray(result?.results) ? result.results : [];
  for (const device of perDevice) {
    await recordAttempt({
      delivery,
      targetType: 'push_subscription',
      targetId: device.id || null,
      // Each device is a distinct target, so the deterministic idempotency key
      // ({delivery}:{target}:{attempt}) already separates them without needing
      // a per-device counter.
      attemptNumber,
      status: device.ok ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED,
      provider: CHANNEL_PROVIDER[CHANNELS.PUSH],
      failureCode: device.ok ? null : (device.reason || 'send_failed'),
      failureReason: device.ok ? null : (device.error || device.reason || null),
    });
  }

  // No devices at all is an explicit, auditable outcome rather than a silent
  // failure — the user simply has nothing registered.
  if (!perDevice.length) {
    await recordAttempt({
      delivery,
      attemptNumber,
      status: DELIVERY_STATUS.FAILED,
      provider: CHANNEL_PROVIDER[CHANNELS.PUSH],
      failureCode: result?.reason || 'no_subscriptions',
      failureReason: result?.reason || 'no_subscriptions',
    });
  }
}

/**
 * Process one claimed delivery: send, record the attempt(s), and move the
 * delivery to its next state. Never throws — a failure here must not abort the
 * rest of the batch.
 */
export async function processDelivery(delivery, deps = {}) {
  const senders = deps.senders || CHANNEL_SENDERS;
  const loadNotification = deps.loadNotification
    || ((id) => UserNotification.findByPk(id));

  const base = {
    deliveryId: delivery.id,
    notificationId: delivery.notificationId,
    companyId: delivery.companyId,
    recipientUserId: delivery.recipientUserId,
    channel: delivery.channel,
  };
  const attemptNumber = delivery.attemptCount; // stamped by the claim
  log('claimed', { ...base, attemptNumber, lockedBy: delivery.lockedBy });

  const notification = await loadNotification(delivery.notificationId);
  if (!notification) {
    // The notification was deleted underneath us; nothing to deliver.
    await transitionDelivery(delivery, DELIVERY_STATUS.CANCELLED, {
      failureCode: 'notification_missing',
      failureReason: 'Notification row no longer exists',
    });
    log('cancelled', { ...base, reason: 'notification_missing' });
    return { status: DELIVERY_STATUS.CANCELLED };
  }

  const send = senders[delivery.channel];
  if (!send) {
    await transitionDelivery(delivery, DELIVERY_STATUS.FAILED, {
      failureCode: 'unsupported_channel',
      failureReason: `No sender registered for channel ${delivery.channel}`,
    });
    return { status: DELIVERY_STATUS.FAILED };
  }

  const payload = toCanonicalPayload(
    typeof notification.toJSON === 'function' ? notification.toJSON() : notification,
  );
  // The canonical payload is built from the notification row, whose userId is
  // the recipient — the worker never guesses an audience of its own.

  let result;
  try {
    result = await send(payload);
  } catch (error) {
    // A channel is not supposed to throw, but if one does it is a transport
    // failure, not a reason to lose the delivery.
    result = { ok: false, reason: 'send_failed', statusCode: error?.statusCode, error: error?.message };
  }

  const provider = CHANNEL_PROVIDER[delivery.channel] || null;

  let effectiveResult = result;
  if (delivery.channel === CHANNELS.PUSH) {
    await recordPushAttempts(delivery, result, attemptNumber);
    if (!result?.ok) {
      // Classify the fan-out as a whole from its device outcomes, rather than
      // from an aggregate object that carries no reason at all.
      effectiveResult = { ...result, ...aggregatePushFailure(Array.isArray(result?.results) ? result.results : []) };
    }
  } else {
    await recordAttempt({
      delivery,
      attemptNumber,
      status: result?.ok ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED,
      provider,
      providerMessageId: result?.ok ? (result.id ?? null) : null,
      failureCode: result?.ok ? null : (result?.reason || 'send_failed'),
      failureReason: result?.ok
        ? null
        : (isUncertainOutcome(result)
          // The provider may actually have accepted this before the connection
          // died. Say so, rather than implying it definitely did not send.
          ? `${result?.error || 'timed out'} (outcome unknown — may have been accepted)`
          : (result?.error || result?.reason || null)),
    });
  }

  if (result?.ok) {
    // 'sent' is the honest ceiling: the provider accepted the handoff. None of
    // push/SMS/email can confirm a human received it, so none of them may claim
    // 'delivered'.
    await transitionDelivery(delivery, DELIVERY_STATUS.SENT);
    log('succeeded', { ...base, attemptNumber, provider, providerMessageId: result.id ?? null });
    return { status: DELIVERY_STATUS.SENT };
  }

  const kind = classifyFailure(effectiveResult);
  const failureCode = isUncertainOutcome(effectiveResult)
    ? 'timeout_uncertain'
    : (effectiveResult?.reason || 'send_failed');
  const failureReason = effectiveResult?.error || effectiveResult?.reason || null;

  if (kind === FAILURE_KIND.PERMANENT) {
    await transitionDelivery(delivery, DELIVERY_STATUS.FAILED, { failureCode, failureReason });
    log('failed_permanent', { ...base, attemptNumber, provider, failureCode });
    return { status: DELIVERY_STATUS.FAILED };
  }

  if (attemptNumber >= MAX_ATTEMPTS) {
    await transitionDelivery(delivery, DELIVERY_STATUS.EXPIRED, { failureCode, failureReason });
    log('expired', { ...base, attemptNumber, provider, failureCode, maxAttempts: MAX_ATTEMPTS });
    return { status: DELIVERY_STATUS.EXPIRED };
  }

  const nextAttemptAt = computeNextAttemptAt(attemptNumber);
  await scheduleRetry(delivery, { nextAttemptAt, failureCode, failureReason });
  log('retry_scheduled', { ...base, attemptNumber, provider, failureCode, nextAttemptAt: nextAttemptAt.toISOString() });
  return { status: DELIVERY_STATUS.RETRYING, nextAttemptAt };
}

/**
 * One worker tick: recover anything abandoned, claim a bounded batch, process
 * it. Batching keeps a single slow provider from monopolising the tick, and the
 * caller's interval decides how often this runs.
 */
export async function runDeliveryWorkerOnce({
  limit = 25,
  workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`,
  now = new Date(),
  claim = claimDueDeliveries,
  recover = recoverStaleProcessing,
  process: processOne = processDelivery,
} = {}) {
  const recovered = await recover({ staleBefore: new Date(now.getTime() - STALE_LOCK_MS) });
  if (recovered) log('stale_recovered', { count: recovered, staleLockMs: STALE_LOCK_MS });

  const claimed = await claim({ channels: WORKER_CHANNELS, limit, lockedBy: workerId, now });
  if (!claimed.length) return { recovered, claimed: 0, results: {} };

  const results = {};
  for (const delivery of claimed) {
    try {
      const outcome = await processOne(delivery);
      results[outcome.status] = (results[outcome.status] || 0) + 1;
    } catch (error) {
      // Isolated so one bad delivery cannot starve the batch. The row stays in
      // 'processing' and stale recovery will pick it up.
      results.error = (results.error || 0) + 1;
      console.error('[notification-delivery] delivery failed to process', {
        deliveryId: delivery.id,
        message: error?.message || String(error),
      });
    }
  }

  return { recovered, claimed: claimed.length, results };
}
