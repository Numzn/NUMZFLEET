import { getLatestErbPrices } from '../reports/adapters/erbAdapter.js';

/**
 * Pushes formatted ERB fuel prices to Traccar server attributes (`web.loginInsight*`)
 * and always mirrors the same text into an in-memory cache served by
 * GET /api/public/login-insight (so the login page works without Traccar HTTP creds).
 *
 * Env (all optional — if missing, sync is skipped silently):
 *   TRACCAR_API_BASE_URL — preferred; falls back to TRACCAR_SERVER_URL (e.g. http://traccar-server:8082)
 *   TRACCAR_API_USER     — Traccar admin email for Basic auth
 *   TRACCAR_API_PASSWORD — Traccar admin password
 */

const ATTR_PRIMARY = 'web.loginInsight';
const ATTR_SECONDARY = 'web.loginInsightSub';

/** Last formatted ERB lines — exposed via GET /api/public/login-insight (no Traccar required to read). */
let publicCache = {
  primary: null,
  secondary: null,
  updatedAt: null,
};

export function getPublicLoginInsight() {
  return { ...publicCache };
}

/** Throttle on-demand ERB fetches from the public login endpoint (LoginInsights polls). */
let lastOnDemandErbAttemptMs = 0;

/**
 * Same ERB path as GET /api/reports/erb/latest (dashboard): getLatestErbPrices → sync cache.
 * Used when the login page has no session; fills public cache without requiring auth.
 */
export async function ensurePublicLoginInsightFromErb() {
  const cur = getPublicLoginInsight();
  if (cur.primary) {
    return cur;
  }

  const now = Date.now();
  const minMs = Math.max(
    15_000,
    parseInt(process.env.LOGIN_INSIGHT_ON_DEMAND_MS || '90000', 10) || 90_000,
  );
  if (lastOnDemandErbAttemptMs > 0 && now - lastOnDemandErbAttemptMs < minMs) {
    return cur;
  }
  lastOnDemandErbAttemptMs = now;

  try {
    const result = await getLatestErbPrices();
    await syncLoginInsightFromErbPrices(result);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[ensurePublicLoginInsightFromErb]', err?.message || err);
    }
  }
  return getPublicLoginInsight();
}

function setPublicLoginInsight(primary, secondary) {
  publicCache = {
    primary: primary || null,
    secondary: secondary || null,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeServerAttributes(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return o && typeof o === 'object' && !Array.isArray(o) ? { ...o } : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...raw };
  }
  return {};
}

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

const formatBand = (label, value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isNaN(n) && Number.isFinite(n)) {
    return `${label} K${n.toFixed(2)}/L`;
  }
  return `${label} ${String(value)}`;
};

const buildInsightLines = (erbResult) => {
  const { prices = {}, meta = {} } = erbResult || {};
  const bands = [
    formatBand('Petrol', prices.petrol),
    formatBand('Diesel', prices.diesel),
    // Keep login copy lean: focus on the two fuels most drivers check first.
  ].filter(Boolean);

  const primary = bands.join(' · ');
  if (!primary) {
    return { primary: null, secondary: null };
  }

  let sub = 'Source: ERB';
  if (meta.fetchedAt) {
    const d = new Date(meta.fetchedAt);
    if (!Number.isNaN(d.getTime())) {
      sub += ` · ${d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
  }

  return { primary, secondary: sub };
};

/**
 * @param {object} erbResult — shape returned by getLatestErbPrices() (prices, meta, source)
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function syncLoginInsightFromErbPrices(erbResult) {
  const { primary, secondary } = buildInsightLines(erbResult);
  if (!primary) {
    return { ok: false, reason: 'no_price_values' };
  }

  // Always publish to in-memory cache so the login page can read /api/public/login-insight
  // even when Traccar HTTP credentials are not set or PUT fails.
  setPublicLoginInsight(primary, secondary);

  const baseUrl = getBaseUrl();
  const authorization = getBasicAuthHeader();

  if (!baseUrl || !authorization) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[traccarLoginInsightSync] Traccar HTTP not configured; insight cached for public endpoint only');
    }
    return { ok: false, reason: 'traccar_api_not_configured' };
  }

  const headers = {
    Authorization: authorization,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  let server;
  try {
    const getRes = await fetch(`${baseUrl}/api/server`, { method: 'GET', headers });
    if (!getRes.ok) {
      const text = await getRes.text().catch(() => '');
      console.error('[traccarLoginInsightSync] GET /api/server failed', getRes.status, text?.slice(0, 200));
      return { ok: false, reason: 'get_server_failed' };
    }
    server = await getRes.json();
  } catch (err) {
    console.error('[traccarLoginInsightSync] GET /api/server error', err?.message || err);
    return { ok: false, reason: 'get_server_error' };
  }

  const attrs = normalizeServerAttributes(server.attributes);
  const prevPrimary = String(attrs[ATTR_PRIMARY] ?? '');
  const prevSecondary = String(attrs[ATTR_SECONDARY] ?? '');

  if (prevPrimary === primary && prevSecondary === secondary) {
    return { ok: true, reason: 'unchanged' };
  }

  attrs[ATTR_PRIMARY] = primary;
  attrs[ATTR_SECONDARY] = secondary;

  const payload = { ...server, attributes: attrs };

  try {
    const putRes = await fetch(`${baseUrl}/api/server`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => '');
      console.error('[traccarLoginInsightSync] PUT /api/server failed', putRes.status, text?.slice(0, 300));
      return { ok: false, reason: 'put_server_failed' };
    }
  } catch (err) {
    console.error('[traccarLoginInsightSync] PUT /api/server error', err?.message || err);
    return { ok: false, reason: 'put_server_error' };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[traccarLoginInsightSync] Login insight attributes updated');
  }

  return { ok: true, reason: 'updated' };
}
