import { resolveCompanyContextForTraccarUser } from '../services/tenantResolverService.js';

/**
 * Attach req.auth with extended context after authenticate.
 * 
 * Populates:
 * - companyId (backward compat — the ACTIVE context's company)
 * - homeCompanyId (identity fact — the user's own company, if any, independent
 *   of platform capability; never changed by active context)
 * - activeContext: { type, companyId, parentCompanyId }
 * - organizationType: 'customer' | 'partner' | null
 * - accessibleCustomerIds: [] (if partner)
 * - accessibleContexts: [] (identity fact — every workspace this user may enter)
 * - roles, isSuperAdmin, numzUserId
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
      companyId: ctx.companyId, // Backward compat
      homeCompanyId: ctx.homeCompanyId, // Identity fact — never changed by active context
      numzUserId: ctx.numzUserId,
      activeContext: ctx.activeContext,
      organizationType: ctx.organizationType,
      accessibleCustomerIds: ctx.accessibleCustomerIds || [],
      accessibleContexts: ctx.accessibleContexts || [], // Identity fact — never changed by active context
      roles: ctx.roles,
      isSuperAdmin: ctx.isSuperAdmin,
      traccarUserId: req.user.id,
    };
    next();
  } catch (error) {
    // Non-fatal: fall back to default context so individual routes are not blocked.
    // Common cause: numz_users table not yet created (migration pending).
    console.warn('[tenantContext] resolution failed, using default context:', error?.message || error);
    req.auth = {
      userId: req.user?.id ?? null,
      companyId: null,
      homeCompanyId: null,
      numzUserId: null,
      activeContext: {
        type: 'customer',
        companyId: null,
        parentCompanyId: null,
      },
      organizationType: null,
      accessibleCustomerIds: [],
      accessibleContexts: [],
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
