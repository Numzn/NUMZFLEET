import { findByTraccarUserId } from '../../modules/profile/profileRepository.js';
import { listForNumzUser, deactivateByEndpoint, touchLastUsed } from '../../modules/pushSubscriptions/pushSubscriptionsRepository.js';
import { sendWebPush, isWebPushConfigured } from '../providers/webPushProvider.js';

function buildPushPayload(payload) {
  return {
    title: payload.title || 'NumzFleet notification',
    body: payload.message,
    data: {
      entityType: payload.entityType,
      entityId: payload.entityId,
      type: payload.type,
    },
  };
}

/**
 * Delivers a notification via Web Push. Responsibility boundary, mirroring
 * emailChannel.js/smsChannel.js — but this channel fans out to EVERY
 * registered device for the user (a user can have several subscriptions),
 * where the other channels have exactly one destination:
 *   - WHO/WHETHER was already decided upstream (audienceResolver.js,
 *     effectiveChannelsResolver.js) — this only ever sees one already-
 *     approved payload.userId.
 *   - WHERE: every push_subscriptions row for that user's numz_users.id —
 *     not a single stored address, since a phone and a laptop are both valid.
 *   - An expired/invalid subscription (the push service's own 404/410) is
 *     deactivated automatically here — the standard signal per RFC 8030 that
 *     a subscription is gone, not a transient failure to retry. Deactivated,
 *     not deleted (Phase 6): the row survives as audit history and
 *     listForNumzUser excludes it from future attempts.
 *   - HOW the message actually reaches a device is webPushProvider.js.
 *
 * @param {import('../contracts/notificationContract.js').CanonicalNotificationPayload} payload
 * @param {{ findUser?: typeof findByTraccarUserId, listSubscriptions?: typeof listForNumzUser,
 *   send?: typeof sendWebPush, deactivateExpired?: typeof deactivateByEndpoint, touch?: typeof touchLastUsed,
 *   isConfigured?: typeof isWebPushConfigured }} [deps]
 *   Injection seam for tests only — every real call site uses the defaults.
 *   isConfigured exists here (unlike email/smsChannel, which check their own
 *   provider's isConfigured() directly) because webPushProvider.js reads its
 *   env vars once at import time into module-scoped consts — by the time a
 *   test mutates process.env, this file's already-static import of it is
 *   frozen, so the real check can't be flipped after the fact the way
 *   emailProvider/smsProvider's per-test dynamic re-import can.
 * @returns {Promise<{ ok: boolean, reason?: string, results?: object[] }>}
 */
export async function deliverPushNotification(payload, deps = {}) {
  const findUser = deps.findUser || findByTraccarUserId;
  const listSubscriptions = deps.listSubscriptions || listForNumzUser;
  const send = deps.send || sendWebPush;
  const deactivateExpired = deps.deactivateExpired || deactivateByEndpoint;
  const touch = deps.touch || touchLastUsed;
  const isConfigured = deps.isConfigured || isWebPushConfigured;

  if (!isConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }
  if (payload?.userId == null) {
    return { ok: false, reason: 'no_recipient' };
  }

  const numzUser = await findUser(payload.userId);
  if (!numzUser) {
    return { ok: false, reason: 'no_recipient' };
  }

  const subscriptions = await listSubscriptions(numzUser.id);
  if (!subscriptions.length) {
    return { ok: false, reason: 'no_subscriptions' };
  }

  const pushPayload = buildPushPayload(payload);

  const results = await Promise.all(subscriptions.map(async (sub) => {
    try {
      await send(sub, pushPayload);
      await touch(sub.id);
      return { ok: true, id: sub.id };
    } catch (error) {
      if (error.expired) {
        await deactivateExpired(sub.endpoint);
        console.warn('[pushChannel] deactivated expired subscription', {
          userId: payload?.userId,
          subscriptionId: sub.id,
        });
        return { ok: false, reason: 'expired_removed', id: sub.id, expired: true, statusCode: error?.statusCode };
      }
      console.error('[pushChannel] push delivery failed', {
        userId: payload?.userId,
        subscriptionId: sub.id,
        message: error?.message || String(error),
      });
      return {
        ok: false,
        reason: 'send_failed',
        id: sub.id,
        statusCode: error?.statusCode,
        error: error?.message,
      };
    }
  }));

  return { ok: results.some((r) => r.ok), results };
}
