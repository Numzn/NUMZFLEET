import { getUserPhoneNumber } from '../../services/userService.js';
import { normalizeZambianPhone } from '../../utils/phoneNumber.js';
import { sendSms, isSmsGatewayConfigured } from '../providers/smsProvider.js';

// Human labels for Traccar's `attributes.alarm` sub-types, as they actually
// arrive wrapped in a generic `type: 'alarm'` event (see
// notificationPolicyService.js's non-geofence alarm catch-all). Labeling
// only — does not change severity, channels, or persist decisions, and
// leaves payload.title/message (which still drive inbox/bell/push) alone.
const ALARM_SUBTYPE_LABELS = {
  sos: 'SOS alert',
  panic: 'Panic alert',
  tamper: 'Tampering detected',
  tampering: 'Tampering detected',
  powercut: 'Power disconnected',
  poweroff: 'Power disconnected',
  lowpower: 'Low power/battery',
  lowbattery: 'Low power/battery',
  jamming: 'GPS jamming detected',
  shock: 'Shock/impact detected',
  accident: 'Accident detected',
  removing: 'Device removal detected',
};

/**
 * Immobilization SMS wording — distinguishes immobilize vs mobilize
 * (re-enable) using metadata already produced by
 * immobilizationNotificationService.js. Only 'completed'/'failed' statuses
 * ever reach this (see immobilizationTransitionPolicy's SMS gating).
 * @param {string} action 'immobilize' | 'mobilize'
 * @param {string} status 'completed' | 'failed'
 */
function immobilizationSmsLabel(action, status) {
  const isMobilize = action === 'mobilize';
  if (status === 'completed') {
    return isMobilize ? 'Vehicle re-enabled (mobilized)' : 'Vehicle immobilized';
  }
  return isMobilize ? 'URGENT: re-enable (mobilize) command failed' : 'URGENT: immobilize command failed';
}

/**
 * Builds SMS text, adding subtype-aware labeling on top of the shared
 * title/message when existing metadata supports it. Falls back to the same
 * `title: message` format every other channel already uses.
 * @param {import('../contracts/notificationContract.js').CanonicalNotificationPayload} payload
 */
export function buildSmsText(payload) {
  const alarmAttr = String(payload?.metadata?.alarmAttr || '').trim().toLowerCase();
  if (alarmAttr && ALARM_SUBTYPE_LABELS[alarmAttr]) {
    return `${ALARM_SUBTYPE_LABELS[alarmAttr]}: ${payload.message}`;
  }

  const action = payload?.metadata?.action;
  const status = payload?.metadata?.status;
  if (typeof payload?.type === 'string' && payload.type.startsWith('immobilization.') && action) {
    return `${immobilizationSmsLabel(action, status)}: ${payload.message}`;
  }

  return payload.title ? `${payload.title}: ${payload.message}` : payload.message;
}

/**
 * Delivers a notification via SMS. Responsibility boundary:
 *   - WHO receives it was already decided upstream by audienceResolver.js
 *     (this function only ever sees one already-resolved payload.userId).
 *   - WHERE the phone number comes from is the recipient's normal Traccar
 *     user profile (tc_users.phone) via userService.getUserPhoneNumber —
 *     no separate phone-number storage, no per-notification manual entry.
 *   - This function's job is only to prepare that one delivery: resolve a
 *     candidate number, normalize it, and skip safely (never throw) if
 *     there isn't a usable one.
 *   - HOW the message actually reaches the gateway is smsProvider.js.
 *
 * `metadata.smsTo` is an explicit override, checked first, for testing or
 * one-off sends to a number that isn't a registered user's own profile
 * number — it is not the primary resolution path and nothing in the
 * codebase sets it as part of normal notification flow today.
 *
 * @param {import('../contracts/notificationContract.js').CanonicalNotificationPayload} payload
 * @returns {Promise<{ ok: boolean, reason?: string, id?: string, state?: string, error?: string, resolvedVia?: string }>}
 */
export async function deliverSmsNotification(payload) {
  if (!isSmsGatewayConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  let rawPhone = payload?.metadata?.smsTo || null;
  let resolvedVia = rawPhone ? 'metadata_override' : null;

  if (!rawPhone && payload?.userId != null) {
    rawPhone = await getUserPhoneNumber(payload.userId);
    resolvedVia = 'user_profile';
  }

  if (!rawPhone) {
    return { ok: false, reason: 'no_recipient_phone' };
  }

  const to = normalizeZambianPhone(rawPhone);
  if (!to) {
    console.warn('[smsChannel] skipping SMS: could not normalize phone number', {
      userId: payload?.userId,
      resolvedVia,
    });
    return { ok: false, reason: 'invalid_phone_number', resolvedVia };
  }

  try {
    const text = buildSmsText(payload);
    const result = await sendSms({ to, message: text });
    return { ok: true, id: result.id, state: result.state, resolvedVia };
  } catch (error) {
    console.error('[smsChannel] SMS delivery failed', {
      userId: payload?.userId,
      resolvedVia,
      message: error?.message || String(error),
    });
    return { ok: false, reason: 'send_failed', error: error?.message, resolvedVia };
  }
}
