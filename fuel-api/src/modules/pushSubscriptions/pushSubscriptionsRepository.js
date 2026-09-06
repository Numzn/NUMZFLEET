import { PushSubscription } from '../../models/index.js';

const ACTIVE = 'active';
const EXPIRED = 'expired';

/** Send-time lookup — only ever want live destinations. A dead token must not cause endless future delivery failures. */
export async function listForNumzUser(numzUserId) {
  return PushSubscription.findAll({ where: { numzUserId, status: ACTIVE } });
}

/**
 * Upsert by endpoint (not by numzUserId — a user has many). Explicit
 * findOrCreate + conditional update, same reasoning as
 * notificationPreferencesRepository.upsertForNumzUser: the composite lookup
 * key here (endpoint alone, since it's globally unique) isn't declared as
 * Sequelize's own upsert() conflict target, so this stays unambiguous.
 *
 * Phase 6: a fresh subscribe call is itself evidence the endpoint is live
 * again, so re-subscribing on a previously-deactivated endpoint reactivates
 * it — the browser proves the subscription works by successfully creating it.
 */
export async function upsertSubscription({
  numzUserId, endpoint, p256dh, auth, userAgent,
}) {
  const [row, created] = await PushSubscription.findOrCreate({
    where: { endpoint },
    defaults: {
      numzUserId, endpoint, p256dh, auth, userAgent, status: ACTIVE,
    },
  });
  if (!created) {
    // Re-subscription on the same device/browser (e.g. key rotation) —
    // refresh keys and ownership rather than leaving stale ones in place.
    await row.update({
      numzUserId, p256dh, auth, userAgent, status: ACTIVE, deactivatedAt: null, deactivationReason: null,
    });
  }
  return row;
}

/**
 * Server-side subscription-status check — distinct from the browser's own
 * `registration.pushManager.getSubscription()`, which only says "does this
 * browser hold a subscription object," not "does fuel-api still have it on
 * record" (e.g. after expiry-cleanup deactivated it server-side but the
 * browser hasn't tried a send yet to discover that). Scoped to the owning
 * user, same as removeForNumzUser — one user's subscription check can't leak
 * another's. Active-only: a deactivated row must report as unsubscribed, not
 * silently mask the earlier expiry from the UI.
 */
export async function findByEndpointForNumzUser(numzUserId, endpoint) {
  return PushSubscription.findOne({ where: { numzUserId, endpoint, status: ACTIVE } });
}

/**
 * Scoped to the owning user — a user can only delete their own subscription.
 * A real delete, deliberately: this is the user themselves asking to stop
 * push on this device, not provider evidence of a dead endpoint — nothing to
 * preserve as delivery-lifecycle history here (see deactivateByEndpoint for
 * that case, and its own comment for why the two paths differ).
 */
export async function removeForNumzUser(numzUserId, endpoint) {
  return PushSubscription.destroy({ where: { numzUserId, endpoint } });
}

/**
 * Unscoped — used by the push channel when the push SERVICE ITSELF reports a
 * subscription gone (404/410, RFC 8030). Deactivates rather than deletes:
 * the row (and everything upstream that already reference its id in
 * notification_delivery_attempts.target_id) stays as real audit history of
 * what this device was and when it stopped working, while listForNumzUser
 * excluding it prevents any further attempt against it. Idempotent — marking
 * an already-inactive row inactive again is a harmless no-op.
 *
 * @returns {Promise<boolean>} whether an active row was found and deactivated
 */
export async function deactivateByEndpoint(endpoint, reason = 'expired') {
  const [count] = await PushSubscription.update(
    { status: EXPIRED, deactivatedAt: new Date(), deactivationReason: reason },
    { where: { endpoint, status: ACTIVE } },
  );
  return count > 0;
}

export async function touchLastUsed(id) {
  return PushSubscription.update({ lastUsedAt: new Date() }, { where: { id } });
}
