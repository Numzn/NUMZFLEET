import { ensureNumzUserRow } from '../../services/numzUserProvisioning.js';
import * as repo from './notificationPreferencesRepository.js';
import { NOTIFICATION_CHANNELS, NOTIFICATION_CATEGORIES } from './constants.js';

// Default when no row exists, per channel. Every channel but email/push
// defaults to true, matching the notification_preferences column's own DB
// default — the frontend should never have to guess what an absent row
// means for those. Email (2026-08-31) and push (2026-09-01) are explicit,
// documented exceptions: each was only ever a display-only stub until its
// respective ship date, so a missing row must NOT be read as "this existing
// user wants this channel" the moment delivery for it becomes real — that
// would silently opt in every user who never touched Settings.
// effectiveChannelsResolver.js (the actual delivery-time gate) reads this
// exact same default, so the Settings UI and enforcement can never disagree
// about what an absent row means.
const DEFAULT_ENABLED_WHEN_MISSING = { email: false, push: false };

/**
 * Always returns the full channel x category matrix. See
 * DEFAULT_ENABLED_WHEN_MISSING above for the one channel-specific exception.
 */
export function toFullMatrix(rows) {
  const byKey = new Map(rows.map((r) => [`${r.channel}:${r.category}`, r.enabled]));
  const items = [];
  NOTIFICATION_CATEGORIES.forEach((category) => {
    NOTIFICATION_CHANNELS.forEach((channel) => {
      const key = `${channel}:${category}`;
      const defaultEnabled = channel in DEFAULT_ENABLED_WHEN_MISSING
        ? DEFAULT_ENABLED_WHEN_MISSING[channel]
        : true;
      items.push({
        channel,
        category,
        enabled: byKey.has(key) ? byKey.get(key) : defaultEnabled,
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
