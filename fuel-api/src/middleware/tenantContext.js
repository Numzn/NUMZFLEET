import { resolveCompanyContextForTraccarUser } from '../services/tenantResolverService.js';

/**
 * Attach req.auth with companyId and roles after authenticate.
 */
export async function attachTenantContext(req, res, next) {
  try {
    if (!req.user) {
      req.auth = null;
      return next();
    }

    const ctx = await resolveCompanyContextForTraccarUser(req.user);
    req.auth = {
      userId: req.user.id,
      companyId: ctx.companyId,
      numzUserId: ctx.numzUserId,
      roles: ctx.roles,
      isSuperAdmin: ctx.isSuperAdmin,
      traccarUserId: req.user.id,
    };
    next();
  } catch (error) {
    // Non-fatal: fall back to default company so individual routes are not blocked.
    // Common cause: numz_users table not yet created (migration pending).
    console.warn('[tenantContext] resolution failed, using default context:', error?.message || error);
    req.auth = {
      userId: req.user?.id ?? null,
      companyId: null,
      numzUserId: null,
      roles: [],
      isSuperAdmin: req.user?.administrator === true,
      traccarUserId: req.user?.id ?? null,
    };
    next();
  }
}

export function requireTenant(req, res, next) {
  if (!req.auth?.companyId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }
  next();
}

export function tenantWhere(companyId, extra = {}) {
  if (!companyId) {
    throw new Error('companyId required for tenant scope');
  }
  return { companyId, ...extra };
}

export default { attachTenantContext, requireTenant, tenantWhere };
