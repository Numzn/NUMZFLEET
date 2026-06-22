/**
 * Headers for same-origin fuel-api requests.
 * Sends x-user-id whenever a Traccar user is in Redux so permissive/hybrid fuel-api can
 * authenticate when JSESSIONID is not sent on /api (cookie Path, cross-subdomain, etc.).
 * Strict strategy ignores this header. Opt out: VITE_FUEL_SEND_USER_ID=false.
 */
function resolveTraccarUserId(user) {
  if (!user || typeof user !== 'object') return null;
  const raw = user.id ?? user.userId;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function fuelApiAuthHeaders(user) {
  const headers = { 'Content-Type': 'application/json' };
  const sendUserIdOff =
    String(import.meta.env.VITE_FUEL_SEND_USER_ID || '').toLowerCase() === 'false';
  const uid = resolveTraccarUserId(user);
  if (!sendUserIdOff && uid != null) {
    headers['x-user-id'] = String(uid);
  }
  return headers;
}

/** Multipart upload — do not set Content-Type; the browser adds the boundary. */
export function fuelApiMultipartHeaders(user) {
  const headers = {};
  const sendUserIdOff =
    String(import.meta.env.VITE_FUEL_SEND_USER_ID || '').toLowerCase() === 'false';
  const uid = resolveTraccarUserId(user);
  if (!sendUserIdOff && uid != null) {
    headers['x-user-id'] = String(uid);
  }
  return headers;
}
