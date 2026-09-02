import { findByTraccarUserId } from '../../modules/profile/profileRepository.js';
import { listForNumzUser } from '../../modules/notificationPreferences/notificationPreferencesRepository.js';
import { CHANNELS } from '../contracts/notificationContract.js';

// Deliberately scoped to EMAIL and PUSH. Inbox, websocket, and SMS dispatch
// unconditionally today (see notificationDispatcher.js) and must keep doing
// so — retroactively enforcing long-dormant preferences on channels that
// already work would be a real behavior change for anyone who toggled one
// off assuming (correctly, until now) that it was a no-op. Email and push
// are the two channels this resolver has any opinion about, because they
// are the two channels that have newly become real (2026-08-31 and
// 2026-09-01 respectively) — see each channel file's own header comment.
//
// Default-when-missing for both is intentionally NOT the shared "true"
// default the Settings UI's toFullMatrix() uses for inapp/sms — see that
// function's own comment for the matching exception. A user who has never
// touched Settings must not start receiving email or push the moment
// delivery for either one goes live.
const GATED_CHANNELS = new Set([CHANNELS.EMAIL, CHANNELS.PUSH]);
const DEFAULT_ENABLED_WHEN_MISSING = { [CHANNELS.EMAIL]: false, [CHANNELS.PUSH]: false };

/**
 * @param {number} userId Traccar user id (same id space publishNotification
 *   already resolves audiences into — not numzUserId).
 * @param {string} category one of NOTIFICATION_CATEGORIES — the
 *   notification's entityType/category, matching what Settings stores against.
 * @param {string[]} channels the policy's own channel list for this notification.
 * @param {{ findUser?: typeof findByTraccarUserId, listPreferences?: typeof listForNumzUser }} [deps]
 *   Injection seam for tests only — every real call site uses the defaults.
 * @returns {Promise<string[]>} channels, with any gated channel (email,
 *   push) removed if this user has it disabled (or unset) for this
 *   category. Ungated channels (inbox, websocket, sms) always pass through
 *   untouched. Never throws — a lookup failure fails closed (drops every
 *   gated channel, keeps every ungated one) rather than risking an
 *   unwanted send.
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
  if (userId == null) {
    return channels.filter((c) => !GATED_CHANNELS.has(c));
  }

  try {
    const numzUser = await findUser(userId);
    if (!numzUser) {
      return channels.filter((c) => !GATED_CHANNELS.has(c));
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
