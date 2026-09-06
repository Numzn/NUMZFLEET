/**
 * Delivery state vocabulary and transition rules.
 *
 * This is DELIVERY state — what the system did with a message. It is kept
 * strictly separate from USER state (read / acknowledged / archived), which
 * lives on the notifications row and is driven by a person, not by a provider.
 * A delivered notification says nothing about whether anyone read it.
 *
 * 'retrying' and 'expired' were added in Phase 3 with the worker that produces
 * them. As predicted in Phase 2, this needed no migration — the status column
 * is a plain VARCHAR (same convention as notifications.severity/urgency).
 */

export const DELIVERY_STATUS = Object.freeze({
  /** Row exists, nothing has been attempted yet. The worker's claim target. */
  PENDING: 'pending',
  /** Claimed and in flight. */
  PROCESSING: 'processing',
  /** A transient failure; waiting for next_attempt_at before another try. */
  RETRYING: 'retrying',
  /** The provider accepted the handoff. NOT proof a human received it. */
  SENT: 'sent',
  /** The provider (or the channel itself) confirmed receipt. */
  DELIVERED: 'delivered',
  /** Terminal failure — a permanent error, no further attempts. */
  FAILED: 'failed',
  /** Terminal: retries were exhausted without a permanent verdict. */
  EXPIRED: 'expired',
  /** Never attempted on purpose: preference off, company suspended, etc. */
  CANCELLED: 'cancelled',
});

/** States that will never change again. */
export const TERMINAL_STATUSES = Object.freeze([
  DELIVERY_STATUS.DELIVERED,
  DELIVERY_STATUS.FAILED,
  DELIVERY_STATUS.EXPIRED,
  DELIVERY_STATUS.CANCELLED,
]);

/** The states the worker is allowed to pick up. */
export const CLAIMABLE_STATUSES = Object.freeze([
  DELIVERY_STATUS.PENDING,
  DELIVERY_STATUS.RETRYING,
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  [DELIVERY_STATUS.PENDING]: [
    DELIVERY_STATUS.PROCESSING,
    DELIVERY_STATUS.SENT,
    DELIVERY_STATUS.DELIVERED,
    DELIVERY_STATUS.FAILED,
    DELIVERY_STATUS.CANCELLED,
  ],
  [DELIVERY_STATUS.PROCESSING]: [
    DELIVERY_STATUS.SENT,
    DELIVERY_STATUS.DELIVERED,
    DELIVERY_STATUS.FAILED,
    DELIVERY_STATUS.CANCELLED,
    // Transient failure with retries left.
    DELIVERY_STATUS.RETRYING,
    // Transient failure on the final permitted attempt.
    DELIVERY_STATUS.EXPIRED,
    // Stale-lock recovery returns an abandoned claim to the queue.
    DELIVERY_STATUS.PENDING,
  ],
  [DELIVERY_STATUS.RETRYING]: [
    DELIVERY_STATUS.PROCESSING,
    DELIVERY_STATUS.EXPIRED,
    DELIVERY_STATUS.CANCELLED,
  ],
  // sent -> delivered is the provider confirming later (a webhook, Phase 6).
  // sent -> failed covers an async bounce/undelivered report.
  [DELIVERY_STATUS.SENT]: [
    DELIVERY_STATUS.DELIVERED,
    DELIVERY_STATUS.FAILED,
  ],
  [DELIVERY_STATUS.DELIVERED]: [],
  [DELIVERY_STATUS.FAILED]: [],
  [DELIVERY_STATUS.EXPIRED]: [],
  [DELIVERY_STATUS.CANCELLED]: [],
});

export function isValidStatus(status) {
  return Object.values(DELIVERY_STATUS).includes(status);
}

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Transitions are forward-only. A late or duplicated provider callback must
 * never drag a delivery backwards (sent -> pending) or resurrect a terminal
 * one — repeated callbacks are expected and must be safe.
 *
 * @returns {boolean} true when `to` may follow `from`
 */
export function canTransition(from, to) {
  if (!isValidStatus(from) || !isValidStatus(to)) return false;
  if (from === to) return true; // idempotent re-report of the same state
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

/**
 * @throws {Error} with statusCode 409 when the transition is not allowed
 */
export function assertTransition(from, to) {
  if (!isValidStatus(to)) {
    const err = new Error(`[deliveries] unknown delivery status: ${to}`);
    err.statusCode = 400;
    throw err;
  }
  if (!canTransition(from, to)) {
    const err = new Error(`[deliveries] invalid delivery transition: ${from} -> ${to}`);
    err.statusCode = 409;
    throw err;
  }
  return true;
}

/**
 * Deterministic attempt identity. Never a timestamp or random value: a retry
 * must be able to reconstruct the key of an attempt it already made, so an
 * uncertain provider response cannot silently become a second message.
 *
 * @param {string} deliveryId
 * @param {string|null} targetId push_subscriptions.id for push; null otherwise
 * @param {number} attemptNumber 1-based
 */
export function buildAttemptIdempotencyKey(deliveryId, targetId, attemptNumber) {
  if (!deliveryId) throw new Error('[deliveries] deliveryId is required for an attempt key');
  return `${deliveryId}:${targetId || 'default'}:${attemptNumber}`;
}
