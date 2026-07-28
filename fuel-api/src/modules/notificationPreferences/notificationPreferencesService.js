import { ensureNumzUserRow } from '../../services/numzUserProvisioning.js';
import * as repo from './notificationPreferencesRepository.js';
import { NOTIFICATION_CHANNELS, NOTIFICATION_CATEGORIES } from './constants.js';

/**
 * Always returns the full channel x category matrix, defaulting any
 * combination without a stored row to `enabled: true` (matching the
 * column's DB default) — the frontend should never have to guess what an
 * absent row means.
 */
function toFullMatrix(rows) {
  const byKey = new Map(rows.map((r) => [`${r.channel}:${r.category}`, r.enabled]));
  const items = [];
  NOTIFICATION_CATEGORIES.forEach((category) => {
    NOTIFICATION_CHANNELS.forEach((channel) => {
      const key = `${channel}:${category}`;
      items.push({
        channel,
        category,
        enabled: byKey.has(key) ? byKey.get(key) : true,
      });
    });
  });
  return items;
}

export async function getPreferences(req) {
  const numzUser = await ensureNumzUserRow(req);
  const rows = await repo.listForNumzUser(numzUser.id);
  return {
    items: toFullMatrix(rows),
    channels: NOTIFICATION_CHANNELS,
    categories: NOTIFICATION_CATEGORIES,
  };
}

export async function putPreferences(req) {
  const numzUser = await ensureNumzUserRow(req);
  const body = req.body || {};
  const entries = Array.isArray(body.items) ? body.items : [];

  const valid = entries.filter((e) => NOTIFICATION_CHANNELS.includes(e?.channel)
    && NOTIFICATION_CATEGORIES.includes(e?.category)
    && typeof e?.enabled === 'boolean');
  if (!valid.length) {
    const err = new Error('items must be a non-empty array of {channel, category, enabled}');
    err.statusCode = 400;
    throw err;
  }

  const rows = await repo.upsertForNumzUser(numzUser.id, valid);
  return {
    items: toFullMatrix(rows),
    channels: NOTIFICATION_CHANNELS,
    categories: NOTIFICATION_CATEGORIES,
  };
}
