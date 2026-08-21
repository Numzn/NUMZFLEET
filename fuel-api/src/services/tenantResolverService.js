import { NumzUser, Company, DEFAULT_COMPANY_ID } from '../models/index.js';
import { hasPlatformSuperAdminRole } from './rolesService.js';

/**
 * Tenant Resolver Service — Identity and Home Context
 *
 * Every authenticated session belongs to exactly one organization: the
 * identity's own home company (or, for a genuinely home-less platform-only
 * identity, the platform itself). There is no cross-company context
 * switching — an administrator who needs to operate a different
 * organization's fleet logs out and authenticates into that organization's
 * own account instead. See docs/PLATFORM_ARCHITECTURE.md and the
 * organization-model design report for why this replaced the earlier
 * active-context-override design (Phase 2D / hierarchical descent).
 *
 * getHomeContext() resolves who the identity is and which company they
 * belong to. resolveCompanyContextForTraccarUser() is what req.auth is
 * built from — it wraps getHomeContext()'s result in the activeContext
 * shape the rest of the app reads, always equal to the identity's own
 * company (never another organization's).
 */

const companyCache = new Map();

/**
 * Resolve the identity's home context: who they are and which company they
 * belong to. Cached per traccarUserId; invalidated via
 * clearCompanyContextCache() whenever a user's role/company assignment
 * changes (see numzUserProvisioning.js, profileService.js).
 */
async function getHomeContext(traccarUser) {
  if (!traccarUser?.id) {
    return {
      companyId: DEFAULT_COMPANY_ID,
      homeCompanyId: null,
      numzUserId: null,
      organizationType: 'customer',
      parentCompanyId: null,
      companyName: null,
      accessibleCustomerIds: [],
      roles: [],
      isSuperAdmin: false,
      numzRole: null,
    };
  }

  const cacheKey = String(traccarUser.id);
  if (companyCache.has(cacheKey)) {
    return companyCache.get(cacheKey);
  }

  let numzUser = await NumzUser.findOne({
    where: { traccarUserId: Number(traccarUser.id), status: 'active' },
  });

  if (!numzUser && traccarUser.administrator) {
    numzUser = await NumzUser.findOne({
      where: { traccarUserId: Number(traccarUser.id) },
    });
  }

  const attrs = traccarUser.attributes || {};
  const numzRole = attrs.numzRole || attrs.numz_role;

  const roles = [];
  let companyId = numzUser?.companyId || DEFAULT_COMPANY_ID;
  let organizationType = 'customer';
  let parentCompanyId = null;
  let companyName = null;
  let accessibleCustomerIds = [];

  // Home company facts — computed whenever the identity has an assigned
  // company, unconditionally. See docs/PLATFORM_ARCHITECTURE.md — identity
  // vs. home context.
  if (numzUser?.companyId) {
    const company = await Company.findByPk(numzUser.companyId, {
      attributes: ['id', 'name', 'organizationType', 'parentCompanyId'],
    });
    organizationType = company?.organizationType || 'customer';
    parentCompanyId = company?.parentCompanyId || null;
    companyName = company?.name || null;

    if (organizationType === 'partner') {
      accessibleCustomerIds = await resolvePartnerAccessibleCustomers(numzUser.companyId);
    }
  }

  // Platform capability — a Traccar admin with no home company (the
  // original, sole case, unchanged) OR a Traccar admin who ALSO has a home
  // company but holds an explicit platform_super_admin role assignment
  // (additive; see rolesService.js's hasPlatformSuperAdminRole). This is a
  // MANAGEMENT CAPABILITY, not a second organization to operate inside —
  // it never changes which company this identity's session is scoped to.
  const hasPlatformRole = numzUser?.id
    ? await hasPlatformSuperAdminRole(numzUser.id)
    : false;
  const isSuperAdmin = traccarUser.administrator === true
    && (!numzUser?.companyId || hasPlatformRole);

  if (isSuperAdmin) {
    roles.push('super_admin');
  }

  // Operational roles for the home company. A pure platform admin
  // (administrator with no home company) gets none of these.
  if (!(traccarUser.administrator && !numzUser?.companyId)) {
    if (traccarUser.administrator || traccarUser.isManager) {
      roles.push('company_admin', 'fleet_manager');
    }
    if (numzRole === 'technician') roles.push('technician');
    if (numzRole === 'dispatcher') roles.push('dispatcher');
    if (!traccarUser.administrator && !traccarUser.isManager) {
      roles.push('driver');
    }
  }

  // homeCompanyId is the identity's own company independent of platform
  // status — null only when there isn't one (pure platform admin, or an
  // unprovisioned user).
  const homeCompanyId = numzUser?.companyId || null;

  if (traccarUser.administrator && !numzUser?.companyId) {
    companyId = null;
    organizationType = null;
  }

  const homeCtx = {
    companyId,
    homeCompanyId,
    numzUserId: numzUser?.id || null,
    organizationType,
    parentCompanyId,
    companyName,
    accessibleCustomerIds,
    roles: [...new Set(roles)],
    isSuperAdmin,
    numzRole: numzRole || null,
  };

  companyCache.set(cacheKey, homeCtx);
  return homeCtx;
}

/**
 * Resolve the full context for a Traccar-authenticated user. This is what
 * req.auth is built from (see middleware/tenantContext.js). activeContext
 * always equals the identity's own home context — platform for a
 * genuinely home-less platform-only identity, their own company otherwise.
 * There is no override: this function has no notion of "operating inside
 * a different organization."
 */
export async function resolveCompanyContextForTraccarUser(traccarUser) {
  if (!traccarUser?.id) {
    return {
      companyId: DEFAULT_COMPANY_ID,
      homeCompanyId: null,
      numzUserId: null,
      activeContext: {
        type: 'customer',
        companyId: DEFAULT_COMPANY_ID,
        companyName: null,
        parentCompanyId: null,
      },
      organizationType: 'customer',
      accessibleCustomerIds: [],
      roles: [],
      isSuperAdmin: false,
    };
  }

  const homeCtx = await getHomeContext(traccarUser);

  const activeContext = homeCtx.isSuperAdmin && homeCtx.companyId == null
    ? {
      type: 'platform', companyId: null, companyName: 'NUMZ Platform', parentCompanyId: null,
    }
    : {
      type: homeCtx.organizationType || 'customer',
      companyId: homeCtx.companyId,
      companyName: homeCtx.companyName || null,
      parentCompanyId: homeCtx.parentCompanyId,
    };

  return {
    companyId: homeCtx.companyId,
    homeCompanyId: homeCtx.homeCompanyId, // Identity fact
    numzUserId: homeCtx.numzUserId,
    activeContext,
    organizationType: homeCtx.organizationType,
    accessibleCustomerIds: homeCtx.accessibleCustomerIds,
    roles: homeCtx.roles,
    isSuperAdmin: homeCtx.isSuperAdmin, // Identity fact
    numzRole: homeCtx.numzRole,
  };
}

/**
 * Resolve all customer companies under a partner.
 * Returns array of customer IDs.
 */
export async function resolvePartnerAccessibleCustomers(partnerCompanyId) {
  if (!partnerCompanyId) {
    return [];
  }

  try {
    const customers = await Company.findAll({
      where: {
        parentCompanyId: partnerCompanyId,
        organizationType: 'customer',
        status: 'active',
      },
      attributes: ['id'],
      raw: true,
    });

    return customers.map((c) => c.id);
  } catch (error) {
    console.warn(`[tenantResolver] Failed to resolve partner customers for ${partnerCompanyId}:`, error?.message);
    return [];
  }
}

export function clearCompanyContextCache() {
  companyCache.clear();
}
