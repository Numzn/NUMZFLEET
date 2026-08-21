/**
 * Traccar HTTP API via Basic auth (service account from backend/.env).
 * Shared by immobilization commands and server-side Routine Service maintenance sync.
 *
 * Env: TRACCAR_API_BASE_URL | TRACCAR_SERVER_URL, TRACCAR_API_USER, TRACCAR_API_PASSWORD,
 *      TRACCAR_API_TIMEOUT_MS (default 20000)
 *
 * TRACCAR_API_TIMEOUT_MS must stay comfortably below EXECUTION_CLAIM_TIMEOUT_SEC
 * (immobilization/executionRecovery.js, default 45s): this bound is what lets a
 * stalled command finish on its own via the honest "delivery_unknown" path before
 * the claim watchdog ever has to guess. Do not close that gap by raising this
 * timeout toward the watchdog's — widen the watchdog's margin instead if needed.
 */

const DEFAULT_TIMEOUT_MS = 20000;

const getBaseUrl = () => {
  const raw = process.env.TRACCAR_API_BASE_URL || process.env.TRACCAR_SERVER_URL || '';
  return raw.replace(/\/$/, '');
};

const getBasicAuthHeader = () => {
  const user = process.env.TRACCAR_API_USER;
  const password = process.env.TRACCAR_API_PASSWORD;
  if (!user || !password) return null;
  const token = Buffer.from(`${user}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
};

export function getTraccarApiTimeoutMs() {
  const raw = process.env.TRACCAR_API_TIMEOUT_MS;
  const n = raw === undefined || raw === '' ? DEFAULT_TIMEOUT_MS : parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/**
 * True when `error` is the local HTTP call giving up on its own timeout —
 * i.e. we never received a response, not that Traccar rejected the request.
 * The underlying command may still have reached Traccar; outcome is unknown.
 */
export function isTimeoutError(error) {
  return error?.name === 'TimeoutError' || error?.name === 'AbortError';
}

export function isTraccarCommandApiConfigured() {
  return Boolean(getBaseUrl() && getBasicAuthHeader());
}

/** @param {string} path Traccar REST path e.g. `/api/maintenance` */
export async function traccarFetch(path, init = {}) {
  const base = getBaseUrl();
  const auth = getBasicAuthHeader();
  if (!base || !auth) {
    const err = new Error('Traccar command API not configured (TRACCAR_SERVER_URL, TRACCAR_API_USER, TRACCAR_API_PASSWORD)');
    err.statusCode = 503;
    throw err;
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = getTraccarApiTimeoutMs();
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json',
        Authorization: auth,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    return response;
  } catch (e) {
    if (isTimeoutError(e)) {
      const err = new Error(`Traccar request timed out after ${timeoutMs}ms (no response received)`);
      err.timedOut = true;
      err.statusCode = 504;
      throw err;
    }
    throw e;
  }
}

/**
 * @param {number} deviceId
 * @returns {Promise<Array<{ type: string }>>}
 */
export async function fetchCommandTypes(deviceId) {
  const params = new URLSearchParams({ deviceId: String(deviceId) });
  const response = await traccarFetch(`/api/commands/types?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(text || `Traccar command types failed (${response.status})`);
    err.statusCode = response.status;
    if (response.status === 401 || response.status === 403) {
      err.authFailed = true;
    }
    throw err;
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * @param {number} deviceId
 * @param {{ type: string, attributes?: object, textChannel?: boolean }} command
 */
export async function sendDeviceCommand(deviceId, command) {
  const body = {
    deviceId: Number(deviceId),
    type: command.type,
    attributes: command.attributes || {},
  };
  if (command.textChannel != null) {
    body.textChannel = command.textChannel;
  }
  const response = await traccarFetch('/api/commands/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const err = new Error(text || `Traccar command send failed (${response.status})`);
    err.statusCode = response.status;
    if (response.status === 401 || response.status === 403) {
      err.authFailed = true;
    }
    err.httpStatus = response.status;
    throw err;
  }
  let bodyJson = { ok: true };
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') && text) {
    try {
      bodyJson = JSON.parse(text);
    } catch {
      bodyJson = { ok: true, raw: text };
    }
  }
  return { ok: true, httpStatus: response.status, body: bodyJson };
}

/**
 * @param {'immobilize'|'mobilize'} action
 * @param {Array<{ type: string }>} types
 * @returns {{ supported: boolean, commandType: string|null, reason: string|null }}
 */
export function resolveCommandTypeForAction(action, types) {
  const typeSet = new Set((types || []).map((t) => t.type));
  if (action === 'immobilize') {
    if (typeSet.has('engineStop')) {
      return { supported: true, commandType: 'engineStop', reason: null };
    }
    if (typeSet.has('custom')) {
      return { supported: true, commandType: 'custom', reason: 'custom_only' };
    }
    return { supported: false, commandType: null, reason: 'no_engine_stop' };
  }
  if (action === 'mobilize') {
    if (typeSet.has('engineResume')) {
      return { supported: true, commandType: 'engineResume', reason: null };
    }
    if (typeSet.has('custom')) {
      return { supported: true, commandType: 'custom', reason: 'custom_only' };
    }
    return { supported: false, commandType: null, reason: 'no_engine_resume' };
  }
  return { supported: false, commandType: null, reason: 'invalid_action' };
}
