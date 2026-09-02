import { PushSubscription } from '../../models/index.js';

export async function listForNumzUser(numzUserId) {
  return PushSubscription.findAll({ where: { numzUserId } });
}

/**
 * Upsert by endpoint (not by numzUserId — a user has many). Explicit
 * findOrCreate + conditional update, same reasoning as
 * notificationPreferencesRepository.upsertForNumzUser: the composite lookup
 * key here (endpoint alone, since it's globally unique) isn't declared as
 * Sequelize's own upsert() conflict target, so this stays unambiguous.
 */
export async function upsertSubscription({
  numzUserId, endpoint, p256dh, auth, userAgent,
}) {
  const [row, created] = await PushSubscription.findOrCreate({
    where: { endpoint },
    defaults: {
      numzUserId, endpoint, p256dh, auth, userAgent,
    },
  });
  if (!created) {
    // Re-subscription on the same device/browser (e.g. key rotation) —
    // refresh keys and ownership rather than leaving stale ones in place.
    await row.update({
      numzUserId, p256dh, auth, userAgent,
    });
  }
  return row;
}

/**
 * Server-side subscription-status check — distinct from the browser's own
 * `registration.pushManager.getSubscription()`, which only says "does this
 * browser hold a subscription object," not "does fuel-api still have it on
 * record" (e.g. after expiry-cleanup removed it server-side but the browser
 * hasn't tried a send yet to discover that). Scoped to the owning user, same
 * as removeForNumzUser — one user's subscription check can't leak another's.
 */
export async function findByEndpointForNumzUser(numzUserId, endpoint) {
  return PushSubscription.findOne({ where: { numzUserId, endpoint } });
}

/** Scoped to the owning user — a user can only delete their own subscription. */
export async function removeForNumzUser(numzUserId, endpoint) {
  return PushSubscription.destroy({ where: { numzUserId, endpoint } });
}

/** Unscoped — used by the push channel to clean up subscriptions the push service itself reports as gone. */
export async function removeByEndpoint(endpoint) {
  return PushSubscription.destroy({ where: { endpoint } });
}

export async function touchLastUsed(id) {
  return PushSubscription.update({ lastUsedAt: new Date() }, { where: { id } });
}
