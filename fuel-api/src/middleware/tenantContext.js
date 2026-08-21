import { resolveCompanyContextForTraccarUser } from '../services/tenantResolverService.js';

/**
 * Attach req.auth with extended context after authenticate.
 *
 * Populates:
 * - companyId (the identity's own company — activeContext's company)
 * - homeCompanyId (identity fact — the user's own company, if any, independent
 *   of platform capability)
 * - activeContext: { type, companyId, parentCompanyId } — always equal to the
 *   identity's own home company (platform for a home-less platform-only
 *   identity). There is no cross-company switching; see
 *   tenantResolverService.js.
 * - organizationType: 'customer' | 'partner' | null
 * - accessibleCustomerIds: [] (if partner)
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
      companyId: ctx.companyId,
      homeCompanyId: ctx.homeCompanyId, // Identity fact
      numzUserId: ctx.numzUserId,
      activeContext: ctx.activeContext,
      organizationType: ctx.organizationType,
      accessibleCustomerIds: ctx.accessibleCustomerIds || [],
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
