/**
 * Traccar REST / map WebSocket paths vs Fuel API under /api.
 *
 * Use traccarPath() only for Traccar (Java) endpoints. Fuel, ERB, and other
 * first-match nginx routes keep literal /api/... (see FUEL_API_PREFIXES).
 */

/**
 * Paths served by fuel-api or ERB under /api (do not use traccarPath).
 * Note: `/api/reports` (POST schedule) and `/api/reports/route|stops|...` are Traccar; only
 * fuel-backed report subpaths are listed here.
 */
export const FUEL_API_PREFIXES = [
  '/api/fuel-requests',
  '/api/vehicle-specs',
  '/api/vehicles',
  '/api/operation-sessions',
  '/api/public',
  '/api/erb',
  '/api/reports/trips',
  '/api/reports/summary',
  '/api/reports/erb/',
  '/api/reports/fuel-summary',
];

const raw = String(import.meta.env.VITE_TRACCAR_PREFIX ?? '').trim();
/** Normalized: "" or "/traccar" (no trailing slash). */
export const TRACCAR_PREFIX = raw.replace(/\/+$/, '');

/** True if this URL path (no origin) should stay on fuel/ERB, not Traccar prefix. */
export function isFuelApiPath(path) {
  const str = (path || '').split('?')[0];
  return FUEL_API_PREFIXES.some(
    (p) => str === p || str.startsWith(`${p}/`) || str.startsWith(`${p}?`),
  );
}

/**
 * @param {string} path - Traccar path starting with / (e.g. "/api/devices", "/api/session")
 * @returns {string} Same path, or "/traccar" + path when VITE_TRACCAR_PREFIX is set
 */
export function traccarPath(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!TRACCAR_PREFIX) {
    return p;
  }
  return `${TRACCAR_PREFIX}${p}`;
}
