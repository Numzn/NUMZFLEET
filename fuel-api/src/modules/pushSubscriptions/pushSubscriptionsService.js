import { ensureNumzUserRow } from '../../services/numzUserProvisioning.js';
import * as repo from './pushSubscriptionsRepository.js';
import { getVapidPublicKey, isWebPushConfigured } from '../../notifications/providers/webPushProvider.js';
import { DEFAULT_COMPANY_ID } from '../../models/index.js';

export async function getPublicKey() {
  return { vapidPublicKey: isWebPushConfigured() ? getVapidPublicKey() : null };
}

export async function subscribe(req) {
  const numzUser = await ensureNumzUserRow(req);
  const { subscription, userAgent } = req.body || {};

  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    const err = new Error('subscription.endpoint, subscription.keys.p256dh, and subscription.keys.auth are required');
    err.statusCode = 400;
    throw err;
  }

  await repo.upsertSubscription({
    numzUserId: numzUser.id,
    companyId: numzUser.companyId || DEFAULT_COMPANY_ID,
    endpoint,
    p256dh,
    auth,
    userAgent: userAgent || req.headers['user-agent'] || null,
  });
  return { ok: true };
}

/**
 * Server-side truth, not the browser's local PushManager state — see
 * repository comment. `req.query.endpoint` because this is a GET.
 */
export async function getStatus(req) {
  const numzUser = await ensureNumzUserRow(req);
  const { endpoint } = req.query || {};
  if (!endpoint) {
    const err = new Error('endpoint query parameter is required');
    err.statusCode = 400;
    throw err;
  }
  const row = await repo.findByEndpointForNumzUser(numzUser.id, endpoint);
  return { subscribed: !!row, lastUsedAt: row?.lastUsedAt || null };
}

export async function unsubscribe(req) {
  const numzUser = await ensureNumzUserRow(req);
  const { endpoint } = req.body || {};
  if (!endpoint) {
    const err = new Error('endpoint is required');
    err.statusCode = 400;
    throw err;
  }
  await repo.removeForNumzUser(numzUser.id, endpoint);
  return { ok: true };
}
