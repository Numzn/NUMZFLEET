import { getLatestErbPrices } from '../reports/adapters/erbAdapter.js';

/**
 * Pushes formatted ERB fuel prices to Traccar server attributes (`web.loginInsight*`)
 * and always mirrors the same text into an in-memory cache served by
 * GET /api/public/login-insight (so the login page works without Traccar HTTP creds).
 *
 * Env (all optional — if missing, sync is skipped silently):
 *   TRACCAR_API_BASE_URL — preferred; falls back to TRACCAR_SERVER_URL (e.g. http://traccar:8082)
 *   TRACCAR_API_USER     — Traccar admin email for Basic auth
 *   TRACCAR_API_PASSWORD — Traccar admin password
 */

const ATTR_PRIMARY = 'web.loginInsight';
const ATTR_SECONDARY = 'web.loginInsightSub';

/**
 * Previous prices used to compute ▲/▼ deltas on next sync.
 * Persists in memory across hourly scheduler ticks; resets on restart.
 * Only updated when prices actually change.
 */
let storedPrices = { petrol: null, diesel: null };

/** Last formatted ERB lines — exposed via GET /api/public/login-insight (no Traccar required to read). */
let publicCache = {
  primary: null,
  secondary: null,
  updatedAt: null,
  /** Same numeric shape as GET /api/reports/erb/latest (when ERB fetch succeeded). */
  prices: null,
};

export function getPublicLoginInsight() {
  return { ...publicCache };
}

function hasAnyNumericPrice(prices) {
  if (!prices || typeof prices !== 'object') return false;
  return ['petrol', 'diesel', 'kerosene', 'jetA1'].some(
    (k) => prices[k] != null && Number.isFinite(Number(prices[k])),
  );
}

/** True if public login-insight payload has usable text or numeric prices. */
export function isLoginInsightPopulated(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.primary) return true;
  return hasAnyNumericPrice(data.prices);
}

/** Throttle on-demand ERB fetches from the public login endpoint (LoginInsights polls). */
let lastOnDemandErbAttemptMs = 0;

/**
 * Same ERB path as GET /api/reports/erb/latest (dashboard): getLatestErbPrices → sync cache.
 * Used when the login page has no session; fills public cache without requiring auth.
 */
export async function ensurePublicLoginInsightFromErb() {
  const cur = getPublicLoginInsight();
  if (cur.primary || hasAnyNumericPrice(cur.prices)) {
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

function normalizePricesForCache(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {
    petrol: raw.petrol != null && Number.isFinite(Number(raw.petrol)) ? Number(raw.petrol) : null,
    diesel: raw.diesel != null && Number.isFinite(Number(raw.diesel)) ? Number(raw.diesel) : null,
    kerosene: raw.kerosene != null && Number.isFinite(Number(raw.kerosene)) ? Number(raw.kerosene) : null,
    jetA1: raw.jetA1 != null && Number.isFinite(Number(raw.jetA1)) ? Number(raw.jetA1) : null,
  };
  return hasAnyNumericPrice(out) ? out : null;
}

function setPublicLoginInsight(primary, secondary, pricesFromErb = undefined) {
  const nextPrices =
    pricesFromErb !== undefined ? normalizePricesForCache(pricesFromErb) : publicCache.prices;
  publicCache = {
    primary: primary || null,
    secondary: secondary || null,
    updatedAt: new Date().toISOString(),
    prices: nextPrices,
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

const buildInsightLines = (erbResult) => {
  const { prices = {}, timestamp } = erbResult || {};

  const petrol = Number(prices.petrol);
  const diesel = Number(prices.diesel);

  if (!Number.isFinite(petrol) || !Number.isFinite(diesel)) {
    return { primary: null, secondary: null };
  }

  // Compute deltas against previously stored prices (null on first run after restart)
  const petrolDiff =
    storedPrices.petrol !== null ? +(petrol - storedPrices.petrol).toFixed(2) : null;
  const dieselDiff =
    storedPrices.diesel !== null ? +(diesel - storedPrices.diesel).toFixed(2) : null;

  // Advance stored prices for next comparison
  storedPrices = { petrol, diesel };

  const fmtDelta = (diff) => {
    if (diff === null || Math.abs(diff) < 0.005) return '';
    return ` ${diff > 0 ? '\u25b2' : '\u25bc'} ${diff > 0 ? '+' : ''}${diff.toFixed(2)}`;
  };

  const primary =
    `Petrol K${petrol.toFixed(2)}${fmtDelta(petrolDiff)}` +
    ` | Diesel K${diesel.toFixed(2)}${fmtDelta(dieselDiff)}`;

  // Optional summary: only shown when a price actually moved
  const dir = (diff) =>
    diff !== null && Math.abs(diff) >= 0.005 ? (diff > 0 ? 'up' : 'down') : null;
  const pDir = dir(petrolDiff);
  const dDir = dir(dieselDiff);
  let summary = null;
  if (pDir && dDir)
    summary = pDir === dDir ? `Both prices ${pDir}` : `Petrol ${pDir}, Diesel ${dDir}`;
  else if (pDir) summary = `Petrol ${pDir}`;
  else if (dDir) summary = `Diesel ${dDir}`;

  // Compact timestamp: "Updated: 20 Apr 21:12"
  let tsLabel = '';
  const rawTs = timestamp;
  if (rawTs) {
    const d = new Date(rawTs);
    if (!Number.isNaN(d.getTime())) {
      tsLabel = `Updated: ${d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}`;
    }
  }

  const secondary = [summary, tsLabel].filter(Boolean).join(' · ') || null;

  return { primary, secondary };
};

/**
 * @param {object} erbResult — shape returned by getLatestErbPrices() (prices, meta, source)
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function syncLoginInsightFromErbPrices(erbResult) {
  const { primary, secondary } = buildInsightLines(erbResult);

  if (!primary) {
    if (hasAnyNumericPrice(erbResult?.prices)) {
      setPublicLoginInsight(null, null, erbResult.prices);
      return { ok: false, reason: 'insight_strings_incomplete' };
    }
    return { ok: false, reason: 'no_price_values' };
  }

  // Always publish to in-memory cache so the login page can read /api/public/login-insight
  // even when Traccar HTTP credentials are not set or PUT fails.
  setPublicLoginInsight(primary, secondary, erbResult?.prices ?? null);

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
