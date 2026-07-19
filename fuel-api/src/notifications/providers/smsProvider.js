// NUMZ SMS Gateway client (capcom6/android-sms-gateway private server).
// Request/response shapes verified against a real successful send during
// that gateway's own Phase 3B validation (POST /api/3rdparty/v1/messages,
// textMessage.text + phoneNumbers[] + withDeliveryReport, HTTP 202) — not
// guessed from generic docs. Auth is HTTP Basic (not Bearer, unlike
// erbAdapter/documentOcrClient) because that's what this gateway's
// /api/3rdparty/v1/* actually requires.

const SMS_GATEWAY_BASE_URL = process.env.SMS_GATEWAY_BASE_URL || '';
const SMS_GATEWAY_USER = process.env.SMS_GATEWAY_USER || '';
const SMS_GATEWAY_PASSWORD = process.env.SMS_GATEWAY_PASSWORD || '';
const SMS_GATEWAY_TIMEOUT_MS = Number(process.env.SMS_GATEWAY_TIMEOUT_MS || 10000);

const logSms = (level, msg, extra = {}) => {
  const line = `[smsProvider] ${msg}`;
  if (level === 'error') console.error(line, extra);
  else if (level === 'warn') console.warn(line, extra);
  else console.info(line, extra);
};

export function isSmsGatewayConfigured() {
  return Boolean(SMS_GATEWAY_BASE_URL && SMS_GATEWAY_USER && SMS_GATEWAY_PASSWORD);
}

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${SMS_GATEWAY_USER}:${SMS_GATEWAY_PASSWORD}`).toString('base64')}`;
}

async function requestSmsGateway(path, { method = 'GET', body } = {}) {
  if (!isSmsGatewayConfigured()) {
    logSms('warn', 'SMS Gateway not configured; cannot call gateway', {
      hint: 'Set SMS_GATEWAY_BASE_URL, SMS_GATEWAY_USER, SMS_GATEWAY_PASSWORD in backend/.env',
    });
    const error = new Error('SMS Gateway is not configured on server');
    error.statusCode = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SMS_GATEWAY_TIMEOUT_MS);

  try {
    const response = await fetch(`${SMS_GATEWAY_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const detail = payload?.message || payload?.error || response.statusText || '';
      logSms('warn', 'SMS Gateway request failed', { path, status: response.status, detail: String(detail).slice(0, 200) });
      const error = new Error(detail || `SMS Gateway request failed with status ${response.status}`);
      error.statusCode = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      logSms('warn', 'SMS Gateway request timed out', { path, timeoutMs: SMS_GATEWAY_TIMEOUT_MS });
      const timeoutError = new Error('SMS Gateway request timed out');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    if (error.statusCode) {
      throw error;
    }
    logSms('error', 'SMS Gateway network/unexpected error', { path, message: error?.message || String(error) });
    const upstreamError = new Error('Failed to reach SMS Gateway');
    upstreamError.statusCode = 502;
    throw upstreamError;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {{ to: string, message: string, withDeliveryReport?: boolean }} params
 *   `to` must be in the format the gateway's carrier accepts (the Phase 3B
 *   test rejected a bare local number with "invalid phone number" until it
 *   was corrected to full international format — pass E.164, e.g. +2609...).
 * @returns {Promise<{ ok: true, id: string, state: string }>}
 */
export async function sendSms({ to, message, withDeliveryReport = true }) {
  if (!to) {
    const error = new Error('SMS recipient phone number is required');
    error.statusCode = 400;
    throw error;
  }
  if (!message) {
    const error = new Error('SMS message text is required');
    error.statusCode = 400;
    throw error;
  }

  const payload = await requestSmsGateway('/api/3rdparty/v1/messages', {
    method: 'POST',
    body: {
      textMessage: { text: message },
      phoneNumbers: [to],
      withDeliveryReport,
    },
  });

  return {
    ok: true,
    id: payload?.id,
    state: payload?.state || 'Pending',
  };
}

/**
 * @param {string} id message id returned by sendSms
 */
export async function getSmsStatus(id) {
  return requestSmsGateway(`/api/3rdparty/v1/messages/${id}`);
}
