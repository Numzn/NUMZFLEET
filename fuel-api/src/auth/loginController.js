import { NumzUser } from '../models/index.js';
import { resolveCompanyContextForTraccarUser } from '../services/tenantResolverService.js';
import { recordLoginAttempt } from '../services/loginAuditService.js';
import { getTraccarApiBase as getTraccarBaseUrl } from '../services/traccarServiceClient.js';

/**
 * NumzTrak login bridge: validates optional numz_users row, establishes Traccar session.
 * Forwards Set-Cookie (JSESSIONID) to the browser.
 */
export async function loginWithTraccarBridge(req, res) {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];
  const audit = (fields) => recordLoginAttempt({ ip, userAgent, ...fields });

  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const numzUser = await NumzUser.findOne({ where: { email, status: 'active' } });
    if (numzUser && numzUser.passwordHash) {
      await audit({ email, outcome: 'failed', method: 'numztrak' });
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
      if (traccarRes.status === 401) {
        await audit({ email, outcome: 'failed' });
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      console.warn('[auth/login] Traccar session failed:', traccarRes.status, responseText.slice(0, 200));
      await audit({ email, outcome: 'error' });
      return res.status(traccarRes.status).json({ error: 'Authentication failed' });
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
      await audit({ email, outcome: 'error' });
      return res.status(502).json({ error: 'Invalid Traccar session response' });
    }

    const tenant = await resolveCompanyContextForTraccarUser(user);
    const numzUserRow = tenant.numzUserId ? await NumzUser.findByPk(tenant.numzUserId) : null;
    await audit({
      email, traccarUserId: user.id, companyId: tenant.companyId, outcome: 'success',
    });
    return res.json({
      user,
      tenant: {
        companyId: tenant.companyId,
        roles: tenant.roles,
        defaultDashboard: numzUserRow?.defaultDashboard || null,
      },
    });
  } catch (error) {
    console.error('[auth/login] failed:', error?.message || error);
    return res.status(500).json({ error: 'Login failed' });
  }
}

export default { loginWithTraccarBridge };
