import { findByTraccarUserId } from '../../modules/profile/profileRepository.js';
import { getUserPhoneNumber } from '../../services/userService.js';
import { normalizeZambianPhone } from '../../utils/phoneNumber.js';
import { listForNumzUser as listPushSubscriptions } from '../../modules/pushSubscriptions/pushSubscriptionsRepository.js';
import { isDeliverableEmail } from '../channels/emailChannel.js';
import { isSmsGatewayConfigured } from '../providers/smsProvider.js';
import { isEmailConfigured } from '../providers/emailProvider.js';
import { isWebPushConfigured } from '../providers/webPushProvider.js';
import { CHANNELS } from '../contracts/notificationContract.js';

/**
 * Whether a channel has a real destination to deliver to at all — the same
 * question each channel implementation (smsChannel.js/emailChannel.js/
 * pushChannel.js) already asks, reusing their exact resolution functions and
 * reason vocabulary, just answered earlier: at planning time, before a
 * PENDING row is ever created and handed to the Phase 3 worker, rather than
 * discovered only when the worker claims and attempts the send.
 *
 * This is existence/format only — "does a phone number exist and look
 * valid" — never full deliverability (a valid-looking number that bounces is
 * still the provider's problem, unchanged). The channel implementations keep
 * their own identical checks: a delay between planning and send (e.g. a
 * quiet-hours hold) means eligibility can genuinely change in between, so
 * this is a first pass, not a replacement for the worker's own defense.
 *
 * inbox/websocket have no destination to check — always eligible.
 *
 * `metadata.smsTo`/`metadata.emailTo` are checked first, ahead of the normal
 * profile lookup — the exact same explicit-override precedence
 * smsChannel.js/emailChannel.js already apply at send time (documented there
 * as "for testing or one-off sends to a number that isn't a registered
 * user's own profile number"). Skipping that here would make the planner
 * suppress something the channel would have successfully sent.
 *
 * @param {string} channel a CHANNELS value
 * @param {number} traccarUserId
 * @param {Record<string, unknown>} [metadata] the notification's own metadata
 * @param {{ findUser?: typeof findByTraccarUserId, getPhone?: typeof getUserPhoneNumber,
 *   listSubscriptions?: typeof listPushSubscriptions }} [deps]
 *   Injection seam for tests only — every real call site uses the defaults.
 *   Same pattern as effectiveChannelsResolver.js/pushChannel.js: push has no
 *   metadata-override escape hatch (unlike sms/email), so an "eligible push"
 *   test case cannot avoid a DB round trip any other way.
 * @returns {Promise<{ eligible: true } | { eligible: false, reason: string }>}
 */
export async function checkChannelEligibility(channel, traccarUserId, metadata = {}, deps = {}) {
  const findUser = deps.findUser || findByTraccarUserId;
  const getPhone = deps.getPhone || getUserPhoneNumber;
  const listSubscriptions = deps.listSubscriptions || listPushSubscriptions;

  if (channel === CHANNELS.INBOX || channel === CHANNELS.WEBSOCKET) {
    return { eligible: true };
  }

  if (channel === CHANNELS.SMS) {
    if (!isSmsGatewayConfigured()) return { eligible: false, reason: 'not_configured' };
    const rawPhone = metadata?.smsTo || await getPhone(traccarUserId);
    if (!rawPhone) return { eligible: false, reason: 'no_recipient_phone' };
    const normalized = normalizeZambianPhone(rawPhone);
    if (!normalized) return { eligible: false, reason: 'invalid_phone_number' };
    return { eligible: true };
  }

  if (channel === CHANNELS.EMAIL) {
    if (!isEmailConfigured()) return { eligible: false, reason: 'not_configured' };
    let address = metadata?.emailTo || null;
    if (!address) {
      const numzUser = await findUser(traccarUserId);
      address = numzUser?.email || null;
    }
    if (!address) return { eligible: false, reason: 'no_recipient_email' };
    if (!isDeliverableEmail(address)) return { eligible: false, reason: 'invalid_email_address' };
    return { eligible: true };
  }

  if (channel === CHANNELS.PUSH) {
    if (!isWebPushConfigured()) return { eligible: false, reason: 'not_configured' };
    const numzUser = await findUser(traccarUserId);
    if (!numzUser) return { eligible: false, reason: 'no_recipient' };
    const subscriptions = await listSubscriptions(numzUser.id);
    if (!subscriptions.length) return { eligible: false, reason: 'no_subscriptions' };
    return { eligible: true };
  }

  // Unknown channel — fail closed rather than silently letting it through.
  return { eligible: false, reason: 'unknown_channel' };
}
