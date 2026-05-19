/**
 * Traccar device commands via HTTP Basic auth (service account).
 * Used by the immobilization evaluator — not a general command orchestration layer.
 */

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

export function isTraccarCommandApiConfigured() {
  return Boolean(getBaseUrl() && getBasicAuthHeader());
}

async function traccarFetch(path, init = {}) {
  const base = getBaseUrl();
  const auth = getBasicAuthHeader();
  if (!base || !auth) {
    const err = new Error('Traccar command API not configured (TRACCAR_SERVER_URL, TRACCAR_API_USER, TRACCAR_API_PASSWORD)');
    err.statusCode = 503;
    throw err;
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: auth,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  return response;
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
    err.statusCode = response.status >= 500 ? 502 : response.status;
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
    err.statusCode = response.status >= 500 ? 502 : response.status;
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
