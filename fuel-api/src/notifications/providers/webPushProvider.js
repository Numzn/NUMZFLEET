// Standard Web Push + VAPID (web-push npm package — the standard, well-vetted
// choice; there's no built-in way to do VAPID signing/aes128gcm encryption in
// Node, and hand-rolling that crypto would be a real security risk). Mirrors
// smsProvider.js/emailProvider.js's shape: env-driven config, an
// isConfigured() guard, a single send function, no secrets in logs.
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || '';

const logPush = (level, msg, extra = {}) => {
  const line = `[webPushProvider] ${msg}`;
  if (level === 'error') console.error(line, extra);
  else if (level === 'warn') console.warn(line, extra);
  else console.info(line, extra);
};

export function isWebPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

let vapidDetailsSet = false;
function ensureVapidDetails() {
  if (vapidDetailsSet) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidDetailsSet = true;
}

/**
 * @param {{ endpoint: string, p256dh: string, auth: string }} subscription
 * @param {object} payload JSON-serializable — becomes the push message body
 * @returns {Promise<{ ok: true }>}
 * @throws {Error & { statusCode?: number, expired?: boolean }} `expired` is
 *   true for 404/410 — the push service itself says this subscription is
 *   gone, the standard signal callers should stop using it (RFC 8030).
 */
export async function sendWebPush(subscription, payload) {
  if (!isWebPushConfigured()) {
    logPush('warn', 'Web Push not configured; cannot send', {
      hint: 'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in backend/.env',
    });
    const error = new Error('Web Push is not configured on server');
    error.statusCode = 503;
    throw error;
  }
  ensureVapidDetails();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (error) {
    const statusCode = error?.statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    if (expired) {
      logPush('warn', 'Push subscription no longer valid', { endpoint: subscription.endpoint, statusCode });
    } else {
      logPush('error', 'Push send failed', { endpoint: subscription.endpoint, statusCode, message: error?.message });
    }
    const err = new Error(error?.body || error?.message || 'Failed to send web push');
    err.statusCode = statusCode;
    err.expired = expired;
    throw err;
  }
}
