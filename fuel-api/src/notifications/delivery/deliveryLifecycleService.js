import { NotificationDelivery } from '../../models/index.js';
import { canTransition, isTerminal } from './deliveryStates.js';
import { findAttemptByProviderMessageForCallback, transitionDelivery } from './deliveryRepository.js';

/**
 * Provider-agnostic: turns one normalized provider event (see
 * providerAdapters/*.js — the only code that knows a specific provider's own
 * payload shape) into a safe, audited delivery-state change.
 *
 *   provider webhook / status lookup
 *     -> provider adapter (parses the raw shape)
 *       -> applyProviderEvent (this file — correlates, checks, transitions)
 *         -> deliveryRepository.js (existing Phase 2/3 writes)
 *
 * Nothing here knows about HTTP, SMS-gateway-specific fields, or SMTP —
 * only the NormalizedProviderEvent shape every adapter produces.
 *
 * @param {import('./providerAdapters/smsGatewayAdapter.js').NormalizedProviderEvent} event
 * @returns {Promise<{
 *   outcome: 'applied'|'duplicate'|'ignored_stale_transition'|'unknown_delivery',
 *   provider: string, providerMessageId: string,
 *   deliveryId?: string, attemptId?: string, companyId?: string,
 *   fromStatus?: string, toStatus: string,
 * }>}
 *   `applied` — a real, forward state change was made.
 *   `duplicate` — the delivery was already at this exact status; a harmless
 *     idempotent re-report (the gateway's own documented retry-on-non-2xx
 *     behavior, or any other repeat, is expected to land here).
 *   `ignored_stale_transition` — the delivery has already moved to a
 *     DIFFERENT terminal (or otherwise incompatible) state since this event
 *     was generated; a late/out-of-order callback must never regress a
 *     newer state, so this is a deliberate no-op, not an error.
 *   `unknown_delivery` — no attempt on file matches this (provider,
 *     providerMessageId) pair. Not an error either: an event for a delivery
 *     we have no record of (wrong environment, stale test data, a provider
 *     retrying past our own retention) must be handled safely, not crash.
 */
export async function applyProviderEvent(event) {
  const base = {
    provider: event.provider,
    providerMessageId: event.providerMessageId,
    toStatus: event.status,
  };

  const attempt = await findAttemptByProviderMessageForCallback(event.provider, event.providerMessageId);
  if (!attempt) {
    return { outcome: 'unknown_delivery', ...base };
  }

  const delivery = await NotificationDelivery.findByPk(attempt.deliveryId);
  if (!delivery) {
    // The attempt survived (it is deliberately not cascade-linked in a way
    // that would ever remove it silently); the parent delivery genuinely
    // does not exist. Same "cannot act, must not crash" handling.
    return {
      outcome: 'unknown_delivery', ...base, attemptId: attempt.id, companyId: attempt.companyId,
    };
  }

  const audit = {
    ...base,
    deliveryId: delivery.id,
    attemptId: attempt.id,
    companyId: delivery.companyId,
    fromStatus: delivery.status,
  };

  if (!canTransition(delivery.status, event.status)) {
    return { outcome: 'ignored_stale_transition', ...audit };
  }

  const isDuplicate = delivery.status === event.status;

  // Attempt-level record first: full audit fidelity for "which attempt did
  // this event relate to, and what did it say" even if the delivery-level
  // write below were to fail for some unrelated reason.
  await attempt.update({
    status: event.status,
    failureCode: event.failureCode,
    failureReason: event.failureReason,
    completedAt: event.occurredAt || new Date(),
  });

  await transitionDelivery(delivery, event.status, {
    failureCode: event.failureCode,
    failureReason: event.failureReason,
  });

  return { outcome: isDuplicate ? 'duplicate' : 'applied', ...audit };
}

/**
 * Deliveries whose current state can still legally move — used by the
 * reconciliation job to decide whether a status lookup is even worth making
 * for a given delivery, without duplicating deliveryStates.js's own
 * transition table here.
 */
export function isReconcilable(status) {
  return !isTerminal(status);
}
