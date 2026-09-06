import { findByTraccarUserId } from '../../modules/profile/profileRepository.js';
import { listForNumzUser } from '../../modules/notificationPreferences/notificationPreferencesRepository.js';
import { CHANNELS } from '../contracts/notificationContract.js';

// Inbox and websocket dispatch unconditionally and must keep doing so — ther
// is no external cost/risk to gate against, and no Settings row is even
// collected for the collapsed 'inapp' toggle's two underlying channels.
//
// SMS joined the gated set in Phase 5 (delivery planner): the Settings UI has
// rendered a real, clickable SMS column in the preference matrix since before
// SMS delivery existed (NotificationsSection.jsx's channel list came from the
// same NOTIFICATION_CHANNELS constants.js already used for inapp/email/push),
// so a user who toggled it off had every reason to believe it already worked
// — this closes that gap rather than perpetuating it. Default-when-missing
// for SMS is `true`, matching toFullMatrix()'s own default for every channel
// except email/push, so a user who never touched Settings sees no change.
//
// Email and push stay `false` when missing: each was only a display-only stub
// until its own ship date (2026-08-31 / 2026-09-01), so a missing row must
// NOT be read as "this existing user wants this channel" the moment real
// delivery went live — that would have silently opted in every user who
// never touched Settings. See each channel file's own header comment.
const GATED_CHANNELS = new Set([CHANNELS.EMAIL, CHANNELS.PUSH, CHANNELS.SMS]);
const DEFAULT_ENABLED_WHEN_MISSING = {
  [CHANNELS.EMAIL]: false,
  [CHANNELS.PUSH]: false,
  [CHANNELS.SMS]: true,
};

/**
 * @param {number} userId Traccar user id (same id space publishNotification
 *   already resolves audiences into — not numzUserId).
 * @param {string} category one of NOTIFICATION_CATEGORIES — the
 *   notification's entityType/category, matching what Settings stores against.
 * @param {string[]} channels the policy's own channel list for this notification.
 * @param {{ findUser?: typeof findByTraccarUserId, listPreferences?: typeof listForNumzUser }} [deps]
 *   Injection seam for tests only — every real call site uses the defaults.
 * @returns {Promise<string[]>} channels, with any gated channel (email, push,
 *   sms) removed if this user has it disabled for this category. Ungated
 *   channels (inbox, websocket) always pass through untouched.
 *
 *   No identifiable user (`userId` missing) or no numz_users row at all (most
 *   of the fleet — the Default-Fleet legacy-fallback path, see
 *   ACCOUNTS_AND_TENANCY.md) is treated exactly like "a numz_users row
 *   exists but has no preference row for this channel/category": each
 *   channel falls back to ITS OWN DEFAULT_ENABLED_WHEN_MISSING value, not a
 *   blanket drop. That distinction matters now that SMS defaults to
 *   enabled — dropping every gated channel unconditionally here would have
 *   silently suppressed SMS for most of the fleet, the exact silent
 *   reinterpretation Phase 5 is required not to do.
 *
 *   A genuine lookup FAILURE (the catch below) stays a strict, unconditional
 *   fail-closed regardless of channel defaults — an error is not the same as
 *   cleanly determining there is no data, and risking an unwanted send on an
 *   error is worse than risking a suppressed one.
 */
export async function resolveEffectiveChannels(userId, category, channels, deps = {}) {
  const findUser = deps.findUser || findByTraccarUserId;
  const listPreferences = deps.listPreferences || listForNumzUser;

  if (!Array.isArray(channels)) {
    return channels;
  }
  const gatedInPlay = channels.some((c) => GATED_CHANNELS.has(c));
  if (!gatedInPlay) {
    return channels;
  }
  const defaultFiltered = (list) => list.filter(
    (c) => !GATED_CHANNELS.has(c) || DEFAULT_ENABLED_WHEN_MISSING[c],
  );
  if (userId == null) {
    return defaultFiltered(channels);
  }

  try {
    const numzUser = await findUser(userId);
    if (!numzUser) {
      return defaultFiltered(channels);
    }

    const rows = await listPreferences(numzUser.id);
    return channels.filter((c) => {
      if (!GATED_CHANNELS.has(c)) return true;
      const row = rows.find((r) => r.channel === c && r.category === category);
      return row ? row.enabled : DEFAULT_ENABLED_WHEN_MISSING[c];
    });
  } catch (error) {
    console.error('[effectiveChannelsResolver] preference lookup failed; dropping gated channels for this send', {
      userId,
      category,
      message: error?.message || String(error),
    });
    return channels.filter((c) => !GATED_CHANNELS.has(c));
  }
}
