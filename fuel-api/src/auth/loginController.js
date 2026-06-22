import { NumzUser } from '../models/index.js';
import { resolveCompanyContextForTraccarUser } from '../services/tenantResolverService.js';

function getTraccarBaseUrl() {
  return (process.env.TRACCAR_API_BASE_URL || process.env.TRACCAR_SERVER_URL || process.env.TRACCAR_API_URL || 'http://traccar:8082').replace(/\/$/, '');
}

/**
 * NumzTrak login bridge: validates optional numz_users row, establishes Traccar session.
 * Forwards Set-Cookie (JSESSIONID) to the browser.
 */
export async function loginWithTraccarBridge(req, res) {
  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const numzUser = await NumzUser.findOne({ where: { email, status: 'active' } });
    if (numzUser && numzUser.passwordHash) {
      return res.status(501).json({
        error: 'NumzTrak password login not yet enabled for this user; use Traccar credentials',
      });
    }

    const body = new URLSearchParams({ email, password });
    const traccarRes = await fetch(`${getTraccarBaseUrl()}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const responseText = await traccarRes.text();
    if (!traccarRes.ok) {
      return res.status(traccarRes.status).send(responseText);
    }

    const setCookies = traccarRes.headers.getSetCookie?.() || [];
    if (setCookies.length) {
      res.setHeader('Set-Cookie', setCookies);
    } else {
      const single = traccarRes.headers.get('set-cookie');
      if (single) res.setHeader('Set-Cookie', single);
    }

    let user;
    try {
      user = JSON.parse(responseText);
    } catch {
      return res.status(502).json({ error: 'Invalid Traccar session response' });
    }

    const tenant = await resolveCompanyContextForTraccarUser(user);
    return res.json({
      user,
      tenant: {
        companyId: tenant.companyId,
        roles: tenant.roles,
      },
    });
  } catch (error) {
    console.error('[auth/login] failed:', error?.message || error);
    return res.status(500).json({ error: 'Login failed' });
  }
}

export default { loginWithTraccarBridge };
