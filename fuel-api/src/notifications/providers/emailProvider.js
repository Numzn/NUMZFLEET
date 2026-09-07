// SMTP email transport (nodemailer). Config-shaped to match the pattern
// already used by smsProvider.js — env-driven, an isConfigured() guard, a
// single send function, bounded timeout, no secrets in logs.
//
// EMAIL_PROVIDER exists as a forward-looking discriminator even though only
// 'smtp' is implemented today — swapping to an HTTP-based transactional API
// later should mean adding a branch here, not touching emailChannel.js or
// anything upstream of it.
import nodemailer from 'nodemailer';

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'smtp';
const EMAIL_HOST = process.env.EMAIL_HOST || '';
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_SECURE = String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;
// Optional — a bare address (today's behavior) is still valid. Set to give
// automated mail a recognizable sender name instead of just an address,
// which providers/spam filters treat as a trust signal.
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || '';
const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 10000);

const logEmail = (level, msg, extra = {}) => {
  const line = `[emailProvider] ${msg}`;
  if (level === 'error') console.error(line, extra);
  else if (level === 'warn') console.warn(line, extra);
  else console.info(line, extra);
};

export function isEmailConfigured() {
  return Boolean(EMAIL_PROVIDER === 'smtp' && EMAIL_HOST && EMAIL_USER && EMAIL_PASSWORD && EMAIL_FROM);
}

let cachedTransport = null;
function getTransport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_SECURE,
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
    connectionTimeout: EMAIL_TIMEOUT_MS,
    greetingTimeout: EMAIL_TIMEOUT_MS,
    socketTimeout: EMAIL_TIMEOUT_MS,
  });
  return cachedTransport;
}

/**
 * @param {{ to: string, subject: string, text: string, html?: string }} params
 * @returns {Promise<{ ok: true, id: string }>}
 */
export async function sendEmail({
  to, subject, text, html,
}) {
  if (!to) {
    const error = new Error('Email recipient address is required');
    error.statusCode = 400;
    throw error;
  }
  if (!subject) {
    const error = new Error('Email subject is required');
    error.statusCode = 400;
    throw error;
  }
  if (!isEmailConfigured()) {
    logEmail('warn', 'Email provider not configured; cannot send', {
      hint: 'Set EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM in backend/.env',
    });
    const error = new Error('Email provider is not configured on server');
    error.statusCode = 503;
    throw error;
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      const timeoutError = new Error('Email send timed out');
      timeoutError.statusCode = 504;
      reject(timeoutError);
    }, EMAIL_TIMEOUT_MS);
  });

  try {
    const info = await Promise.race([
      getTransport().sendMail({
        from: EMAIL_FROM_NAME ? { name: EMAIL_FROM_NAME, address: EMAIL_FROM } : EMAIL_FROM,
        to,
        subject,
        text,
        html: html || undefined,
        // Its absence is itself a negative signal to Gmail/Yahoo's spam
        // classifiers for automated mail — a mailto target, not an HTTPS
        // one-click link (numz.site has no MX record to receive replies to
        // a real unsubscribe endpoint), so List-Unsubscribe-Post is
        // deliberately not set — that header only applies to the HTTPS variant.
        headers: { 'List-Unsubscribe': `<mailto:${EMAIL_FROM}?subject=unsubscribe>` },
      }),
      timeoutPromise,
    ]);
    return { ok: true, id: info?.messageId };
  } catch (error) {
    // Never log auth details — only the transport's own error message, which
    // for nodemailer/SMTP failures does not include the configured password.
    if (error?.statusCode === 504) {
      logEmail('warn', 'Email send timed out', { to, timeoutMs: EMAIL_TIMEOUT_MS });
      throw error;
    }
    logEmail('error', 'Email send failed', { to, message: error?.message || String(error) });
    const sendError = new Error(error?.message || 'Failed to send email');
    sendError.statusCode = error?.statusCode || 502;
    throw sendError;
  }
}
