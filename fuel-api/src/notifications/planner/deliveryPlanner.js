import { CHANNELS } from '../contracts/notificationContract.js';
import { resolveEffectiveChannels } from '../orchestrator/effectiveChannelsResolver.js';
import { checkRecipientEligibility } from './recipientEligibility.js';
import { checkChannelEligibility } from './channelEligibility.js';
import { isWithinQuietHours, quietHoursEndAfter } from './quietHours.js';

/**
 * The one authoritative place that decides, per recipient, which requested
 * channels actually become a delivery — and why, when they don't.
 *
 *   canonical notification + recipient + policy + preferences + eligibility
 *   + timing rules  →  effective channel deliveries
 *
 * Every other module (preferences, eligibility, quiet hours) answers one
 * narrow question; this composes them in a fixed order and produces one
 * decision per requested channel. No provider-specific logic lives here —
 * only WHETHER and WHEN, never HOW.
 *
 * Order of checks, and why:
 *   1. Recipient eligibility (account status, tenant match) — a property of
 *      the PERSON, independent of channel. A failure here suppresses every
 *      requested channel uniformly, including inbox: if this recipient
 *      should not have this notification at all, that includes the durable
 *      record, not just the external channels.
 *   2. Preference (per channel) — did this user turn this channel off for
 *      this category. `mandatory` can override a preference-based
 *      suppression; it cannot override anything below this point.
 *   3. Channel eligibility (per channel) — does a real destination exist
 *      (phone/email/push subscription). Never overridden by `mandatory`:
 *      there is no policy that can conjure a phone number that isn't there.
 *   4. Quiet hours — only for the durable, worker-driven external channels
 *      (push/sms/email). inbox is the system of record and must never be
 *      held; websocket is real-time-or-nothing and holding it is meaningless
 *      (a client that isn't connected right now never receives a "held"
 *      realtime event later anyway — see notificationDispatcher.js).
 *      `mandatory` can bypass this too, per policy.
 *
 * @param {{
 *   userId: number, companyId: string, explicitCompanyId: boolean,
 *   category: string, channels: string[], mandatory?: boolean, now?: Date,
 *   metadata?: Record<string, unknown>,
 * }} args
 * @param {{ checkRecipient?: typeof checkRecipientEligibility,
 *   resolvePreferences?: typeof resolveEffectiveChannels,
 *   checkChannel?: typeof checkChannelEligibility }} [deps]
 *   Injection seam for tests only — every real call site uses the defaults.
 * @returns {Promise<Array<{
 *   channel: string,
 *   decision: 'deliver'|'suppress'|'delay',
 *   reason?: string,
 *   nextAttemptAt?: Date,
 *   overrideNote?: string,
 * }>>}
 */
export async function planDeliveries({
  userId,
  companyId,
  explicitCompanyId = false,
  category,
  channels,
  mandatory = false,
  now = new Date(),
  metadata = {},
}, deps = {}) {
  const checkRecipient = deps.checkRecipient || checkRecipientEligibility;
  const resolvePreferences = deps.resolvePreferences || resolveEffectiveChannels;
  const checkChannel = deps.checkChannel || checkChannelEligibility;

  if (!Array.isArray(channels) || !channels.length) return [];

  const recipientCheck = await checkRecipient({
    traccarUserId: userId,
    companyId,
    explicitCompanyId,
  });
  if (!recipientCheck.eligible) {
    return channels.map((channel) => ({
      channel,
      decision: 'suppress',
      reason: recipientCheck.reason,
    }));
  }

  const preferenceApproved = new Set(await resolvePreferences(userId, category, channels));

  const plan = [];
  for (const channel of channels) {
    const preferenceOff = !preferenceApproved.has(channel);
    if (preferenceOff && !mandatory) {
      plan.push({ channel, decision: 'suppress', reason: 'preference_disabled' });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- one recipient's few channels; not worth a Promise.all's added complexity here.
    const channelCheck = await checkChannel(channel, userId, metadata);
    if (!channelCheck.eligible) {
      plan.push({ channel, decision: 'suppress', reason: channelCheck.reason });
      continue;
    }

    const isQuietHoursSubject = channel === CHANNELS.SMS
      || channel === CHANNELS.EMAIL
      || channel === CHANNELS.PUSH;
    if (isQuietHoursSubject && !mandatory && isWithinQuietHours(now)) {
      plan.push({
        channel,
        decision: 'delay',
        reason: 'quiet_hours_delayed',
        nextAttemptAt: quietHoursEndAfter(now),
      });
      continue;
    }

    plan.push({
      channel,
      decision: 'deliver',
      overrideNote: (preferenceOff && mandatory) ? 'mandatory_override:preference_disabled' : null,
    });
  }

  return plan;
}
