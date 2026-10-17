import { normalizeBoundaryGeometry, isValidPosition } from './boundaryGeometry.js';

/**
 * Search-only proxy over OpenStreetMap Nominatim for "Search Boundary".
 * Nothing is stored here — saving still goes browser → Traccar like every
 * other geofence. Respects Nominatim's usage policy: identifying User-Agent,
 * at most one request per second (serialized), and results cached.
 */

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'NUMZFLEET-geofence-search/1.0 (numz.site)';
const COUNTRY_CODES = (process.env.GEOFENCE_SEARCH_COUNTRIES ?? 'zm').trim();
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = Number(process.env.NOMINATIM_RETRY_DELAY_MS ?? 700);
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 200;
const MAX_QUERY_LEN = 100;
const MIN_QUERY_LEN = 3;

export class BoundarySearchError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const normalizeQuery = (raw) => String(raw ?? '').trim().replace(/\s+/g, ' ');

const cache = new Map(); // key -> { at, value } ; insertion order = age order
let lastCallAt = 0;
let queue = Promise.resolve();

export const __resetBoundarySearchState = () => {
  cache.clear();
  lastCallAt = 0;
  queue = Promise.resolve();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Serialize upstream calls and space them >= MIN_INTERVAL_MS apart. */
const throttled = (fn) => {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
};

// Nominatim address types → what a Zambian fleet manager would call them.
const LEVEL_LABELS = {
  state: 'province / state',
  state_district: 'district',
  county: 'district',
  region: 'region',
  city: 'city',
  town: 'town',
  village: 'village',
  municipality: 'municipality',
  suburb: 'suburb',
  neighbourhood: 'neighbourhood',
  quarter: 'quarter',
  country: 'country',
};

const levelLabel = (r) => {
  const t = String(r.addresstype || r.type || r.category || '');
  return LEVEL_LABELS[t] || t.replace(/_/g, ' ');
};

/** Pure: map raw Nominatim geojson features to result rows. Exported for tests. */
export const mapNominatimFeatures = (features) => {
  const results = [];
  let pointOnly = 0;
  let invalid = 0;
  const pointResults = [];
  (Array.isArray(features) ? features : []).forEach((f) => {
    const p = f?.properties || {};
    const norm = normalizeBoundaryGeometry(f?.geometry);
    if (!norm.ok) {
      if (norm.reason === 'not_an_area') {
        pointOnly += 1;
        const c = f?.geometry?.type === 'Point' ? f.geometry.coordinates : null;
        if (isValidPosition(c) && pointResults.length < 5) {
          pointResults.push({
            id: `${p.osm_type || 'x'}:${p.osm_id ?? pointOnly}`,
            name: p.name || p.display_name?.split(',')[0] || 'Unnamed',
            displayName: p.display_name || '',
            level: levelLabel(p),
            center: [c[0], c[1]],
          });
        }
      } else invalid += 1;
      return;
    }
    const addr = p.address || {};
    results.push({
      id: `${p.osm_type || 'x'}:${p.osm_id ?? results.length}`,
      name: p.name || p.display_name?.split(',')[0] || 'Unnamed',
      displayName: p.display_name || '',
      level: levelLabel(p),
      parent: addr.city || addr.state || addr.county || addr.country || '',
      geometry: norm.geometry,
      areaKm2: norm.areaKm2,
      vertices: norm.vertices,
      notes: norm.notes,
    });
  });
  return { results, pointOnly, pointResults, invalid };
};

export const searchBoundaries = async (rawQuery, { fetchImpl = fetch } = {}) => {
  const q = normalizeQuery(rawQuery);
  if (q.length < MIN_QUERY_LEN) {
    throw new BoundarySearchError(400, 'query_too_short', `Enter at least ${MIN_QUERY_LEN} characters.`);
  }
  if (q.length > MAX_QUERY_LEN) {
    throw new BoundarySearchError(400, 'query_too_long', 'Search text is too long.');
  }

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.value, cached: true };

  const params = new URLSearchParams({
    q,
    format: 'geojson',
    polygon_geojson: '1',
    polygon_threshold: '0.0005',
    addressdetails: '1',
    limit: '10',
  });
  if (COUNTRY_CODES) params.set('countrycodes', COUNTRY_CODES);

  let body;
  try {
    body = await throttled(async () => {
      const attempt = async () => {
        const res = await fetchImpl(`${NOMINATIM_URL}?${params}`, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new BoundarySearchError(502, 'upstream_error', 'Boundary service returned an error.');
        return res.json();
      };
      // Retry only connect/DNS-level failures (nothing reached Nominatim) — not
      // timeouts or HTTP errors. Slow links make Node's short connect attempt
      // fail intermittently.
      for (let n = 1; ; n += 1) {
        try {
          return await attempt();
        } catch (e) {
          const transient = !(e instanceof BoundarySearchError) && e?.name !== 'TimeoutError' && e?.name !== 'AbortError';
          if (!transient || n >= MAX_ATTEMPTS) throw e;
          console.warn(`[geofenceBoundarySearch] network error (attempt ${n}/${MAX_ATTEMPTS}):`, e?.cause?.code || e?.message);
          await sleep(RETRY_DELAY_MS);
        }
      }
    });
  } catch (e) {
    if (e instanceof BoundarySearchError) throw e;
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    if (!timedOut) console.warn('[geofenceBoundarySearch] upstream failure:', e?.cause?.code || e?.message);
    throw new BoundarySearchError(
      timedOut ? 504 : 502,
      timedOut ? 'upstream_timeout' : 'upstream_unreachable',
      timedOut ? 'Boundary service timed out.' : 'Boundary service is unreachable.',
    );
  }

  const value = mapNominatimFeatures(body?.features);
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return { ...value, cached: false };
};
