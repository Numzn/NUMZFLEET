// Shared Traccar admin-API client (Basic Auth via TRACCAR_API_USER/TRACCAR_API_PASSWORD).
// Extracted from companyProvisioningService.js so other modules (profile) can reuse the
// same authenticated fetch instead of duplicating it.

export const getTraccarApiBase = () => {
  const raw = process.env.TRACCAR_API_BASE_URL || process.env.TRACCAR_SERVER_URL || process.env.TRACCAR_API_URL || 'http://traccar:8082';
  return raw.replace(/\/$/, '');
};

const getTraccarBasicAuth = () => {
  const user = process.env.TRACCAR_API_USER;
  const password = process.env.TRACCAR_API_PASSWORD;
  if (!user || !password) return null;
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
};

export async function traccarServiceFetch(path, init = {}) {
  const base = getTraccarApiBase();
  const auth = getTraccarBasicAuth();
  if (!base || !auth) {
    const err = new Error('Traccar service API not configured');
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
  if (!response.ok) {
    const text = await response.text();
    const err = new Error(text || `Traccar API ${response.status}`);
    err.statusCode = response.status;
    throw err;
  }
  if (response.status === 204) return null;
  return response.json();
}

/**
 * Confirms a plaintext password matches by attempting a real Traccar login —
 * Traccar's admin API has no "verify without creating a session" endpoint, and
 * traccarServiceFetch's Basic Auth is service-level, not the user's own
 * credentials, so this is the only way to check a password is actually correct.
 */
export async function verifyTraccarCredentials(email, password) {
  const base = getTraccarApiBase();
  const body = new URLSearchParams({ email, password });
  const response = await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return false;

  // A successful POST here creates a real, live Traccar session (same
  // endpoint loginController.js uses for real logins, which does capture and
  // forward this same Set-Cookie) — terminate it immediately rather than
  // leaking one live, never-revoked session per verification. Best-effort:
  // never let cleanup failure fail the password change itself.
  try {
    const setCookies = response.headers.getSetCookie?.() || [];
    const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
    if (cookieHeader) {
      await fetch(`${base}/api/session`, {
        method: 'DELETE',
        headers: { Cookie: cookieHeader },
      });
    }
  } catch (e) {
    console.warn('[traccarServiceClient] failed to terminate verification session:', e?.message || e);
  }

  return true;
}

export default { traccarServiceFetch, verifyTraccarCredentials };
