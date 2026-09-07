import { findByTraccarUserId } from '../../modules/profile/profileRepository.js';
import { sendEmail, isEmailConfigured } from '../providers/emailProvider.js';

// The placeholder domain numzUserProvisioning.js's createForTraccarUser()
// writes when Traccar itself has no real email on record
// (`user${id}@fleet.local`) — never a real deliverable address. Recognized
// here so a placeholder never silently "succeeds" as a real send.
const PLACEHOLDER_EMAIL_DOMAIN = '@fleet.local';
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isDeliverableEmail(address) {
  if (!address || typeof address !== 'string') return false;
  if (address.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN)) return false;
  return EMAIL_FORMAT.test(address);
}

const SENDER_FOOTER_TEXT = 'NUMZ Technologies — automated fleet notification. '
  + 'Manage what you receive by email in NUMZFLEET Settings > Notifications.';

/**
 * Builds a plain-text body. Deliberately simple — this is a notification
 * relay, not a templated marketing/transactional email system; the same
 * title/message every other channel already renders, in the recipient's inbox.
 * Carries a short sender/footer line (who this is from, how to manage it) —
 * its absence reads as an incomplete/auto-generated message to spam filters,
 * independent of the actual content.
 * @param {import('../contracts/notificationContract.js').CanonicalNotificationPayload} payload
 */
export function buildEmailBody(payload) {
  const lines = [payload.message || ''];
  if (payload.metadata && Object.keys(payload.metadata).length) {
    lines.push('', '—', `Reference: ${payload.entityType || 'notification'}/${payload.entityId || ''}`);
  }
  lines.push('', '--', SENDER_FOOTER_TEXT);
  return lines.join('\n');
}

export function buildEmailHtml(payload) {
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">
<p>${escape(payload.message)}</p>
<p style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:12px;color:#666;">${escape(SENDER_FOOTER_TEXT)}</p>
</body>
</html>`;
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
    return {
      ok: false,
      reason: 'send_failed',
      // See smsChannel.js — structured status for the worker's classifier.
      statusCode: error?.statusCode,
      error: error?.message,
      resolvedVia,
    };
  }
}
