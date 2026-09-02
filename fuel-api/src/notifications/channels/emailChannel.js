import { findByTraccarUserId } from '../../modules/profile/profileRepository.js';
import { sendEmail, isEmailConfigured } from '../providers/emailProvider.js';

// The placeholder domain numzUserProvisioning.js's createForTraccarUser()
// writes when Traccar itself has no real email on record
// (`user${id}@fleet.local`) — never a real deliverable address. Recognized
// here so a placeholder never silently "succeeds" as a real send.
const PLACEHOLDER_EMAIL_DOMAIN = '@fleet.local';
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isDeliverableEmail(address) {
  if (!address || typeof address !== 'string') return false;
  if (address.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN)) return false;
  return EMAIL_FORMAT.test(address);
}

/**
 * Builds a plain-text body. Deliberately simple — this is a notification
 * relay, not a templated marketing/transactional email system; the same
 * title/message every other channel already renders, in the recipient's inbox.
 * @param {import('../contracts/notificationContract.js').CanonicalNotificationPayload} payload
 */
function buildEmailBody(payload) {
  const lines = [payload.message || ''];
  if (payload.metadata && Object.keys(payload.metadata).length) {
    lines.push('', '—', `Reference: ${payload.entityType || 'notification'}/${payload.entityId || ''}`);
  }
  return lines.join('\n');
}

function buildEmailHtml(payload) {
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  return `<p>${escape(payload.message)}</p>`;
}

/**
 * Delivers a notification via email. Responsibility boundary, mirroring
 * smsChannel.js:
 *   - WHO receives it was already decided upstream by audienceResolver.js;
 *     WHETHER this user actually wants it on this channel was already
 *     decided upstream by effectiveChannelsResolver.js. This function only
 *     ever sees one already-resolved, already-approved payload.userId.
 *   - WHERE the address comes from is the recipient's own numz_users.email
 *     (reconciled from Traccar on login — see numzUserProvisioning.js), not
 *     a separate email-storage concept.
 *   - This function's job is only to prepare and attempt that one delivery.
 *   - HOW the message actually reaches an inbox is emailProvider.js.
 *
 * `metadata.emailTo` is an explicit override, checked first — same purpose
 * as smsChannel.js's `metadata.smsTo`: testing/one-off sends, not part of
 * normal notification flow today.
 *
 * @param {import('../contracts/notificationContract.js').CanonicalNotificationPayload} payload
 * @returns {Promise<{ ok: boolean, reason?: string, id?: string, error?: string, resolvedVia?: string }>}
 */
export async function deliverEmailNotification(payload) {
  if (!isEmailConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  let address = payload?.metadata?.emailTo || null;
  let resolvedVia = address ? 'metadata_override' : null;

  if (!address && payload?.userId != null) {
    const numzUser = await findByTraccarUserId(payload.userId);
    address = numzUser?.email || null;
    resolvedVia = 'user_profile';
  }

  if (!address) {
    return { ok: false, reason: 'no_recipient_email', resolvedVia };
  }

  if (!isDeliverableEmail(address)) {
    console.warn('[emailChannel] skipping email: no deliverable address on file', {
      userId: payload?.userId,
      resolvedVia,
    });
    return { ok: false, reason: 'invalid_email_address', resolvedVia };
  }

  try {
    const subject = payload.title || 'NumzFleet notification';
    const result = await sendEmail({
      to: address,
      subject,
      text: buildEmailBody(payload),
      html: buildEmailHtml(payload),
    });
    return { ok: true, id: result.id, resolvedVia };
  } catch (error) {
    console.error('[emailChannel] email delivery failed', {
      userId: payload?.userId,
      resolvedVia,
      message: error?.message || String(error),
    });
    return { ok: false, reason: 'send_failed', error: error?.message, resolvedVia };
  }
}
