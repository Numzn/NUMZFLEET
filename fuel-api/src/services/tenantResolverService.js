import { NumzUser, Company, ActiveContext, DEFAULT_COMPANY_ID } from '../models/index.js';
import { hasPlatformSuperAdminRole } from './rolesService.js';

/**
 * Tenant Resolver Service — Identity vs. Active Context (Phase 2D)
 *
 * Two distinct concepts:
 *
 * 1. IDENTITY — "Who is this user?" Derived purely from the Traccar-authenticated
 *    user and their numz_users row (home company, roles, isSuperAdmin). Cached
 *    per traccarUserId (companyCache below) since it rarely changes; invalidated
 *    via clearCompanyContextCache() whenever a user's role/company assignment
 *    changes (see numzUserProvisioning.js, profileService.js).
 *
 * 2. ACTIVE CONTEXT — "Which organization is this user currently operating in?"
 *    Defaults to the identity's home context (platform for a super admin, the
 *    user's own company otherwise), but can be overridden per-request via the
 *    active_contexts table (see switchActiveContext / resetActiveContext).
 *    The override is re-validated on every read (NEVER cached) so a request
 *    immediately after a switch — or after access is revoked — sees the correct,
 *    authoritative result.
 *
 * resolveCompanyContextForTraccarUser() returns the merged result (home identity
 * facts + active context), which is what the rest of the app (req.auth) reads.
 */

const companyCache = new Map();

/**
 * Resolve the identity's HOME context: who they are and which company they
 * belong to by default. This is the pre-Phase-2D behavior, unaffected by any
 * active-context override. Cached per traccarUserId.
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
      accessibleContexts: [],
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
  // company, unconditionally (previously this only ran in the "not a pure
  // platform admin" branch below, which made a platform admin having a home
  // company unrepresentable). See docs/PLATFORM_ARCHITECTURE.md — identity
  // vs. active context.
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
  // (additive; see rolesService.js's hasPlatformSuperAdminRole).
  const hasPlatformRole = numzUser?.id
    ? await hasPlatformSuperAdminRole(numzUser.id)
    : false;
  const isSuperAdmin = traccarUser.administrator === true
    && (!numzUser?.companyId || hasPlatformRole);

  if (isSuperAdmin) {
    roles.push('super_admin');
  }

  // Operational roles for the home company. Unchanged from before for every
  // case that existed previously: a pure platform admin (administrator with
  // no home company) still gets none of these, exactly as today. What's new
  // is that this block is now reachable for a platform admin who ALSO has a
  // home company (previously that combination could not occur at all).
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
  // unprovisioned user). companyId below keeps its pre-existing meaning
  // (the identity's default active-context company) for every other
  // function in this file — null only for a pure platform admin, exactly
  // as before.
  const homeCompanyId = numzUser?.companyId || null;

  if (traccarUser.administrator && !numzUser?.companyId) {
    companyId = null;
    organizationType = null;
  }

  const accessibleContexts = [];
  if (homeCompanyId) {
    accessibleContexts.push({
      type: organizationType || 'customer',
      companyId: homeCompanyId,
      companyName,
      label: 'My Fleet',
    });
  }
  if (isSuperAdmin) {
    accessibleContexts.push({
      type: 'platform',
      companyId: null,
      companyName: 'NUMZ Platform',
      label: 'Platform',
    });
  }

  const homeCtx = {
    companyId,
    homeCompanyId,
    numzUserId: numzUser?.id || null,
    organizationType,
    parentCompanyId,
    companyName,
    accessibleCustomerIds,
    accessibleContexts,
    roles: [...new Set(roles)],
    isSuperAdmin,
    numzRole: numzRole || null,
  };

  companyCache.set(cacheKey, homeCtx);
  return homeCtx;
}

/**
 * Can this identity (their home context) enter the given target company as an
 * active context? Authoritative, backend-only check — never trust the caller.
 *
 *  - Platform (isSuperAdmin): any company.
 *  - Partner: their own partner company, or any customer under it.
 *  - Customer: only their own company.
 *
 * Named distinctly from scopeValidationService.js's canAccessCompany(auth,
 * requestedCompanyId) — that one gates ongoing per-request DATA access using
 * the already-active context; this one gates a CONTEXT SWITCH itself, using
 * the identity's home context and a real Company model instance. Same
 * underlying question ("can this identity touch this company") asked at two
 * different moments with two different input shapes — not interchangeable,
 * kept as two functions deliberately, disambiguated by name so they don't
 * read as the same thing when grepped.
 */
export function canEnterCompanyContext(homeCtx, targetCompany) {
  if (!targetCompany) return false;
  if (homeCtx.isSuperAdmin) return true;
  if (!homeCtx.companyId) return false;
  if (String(targetCompany.id) === String(homeCtx.companyId)) return true;
  if (
    homeCtx.organizationType === 'partner'
    && targetCompany.organizationType === 'customer'
    && targetCompany.parentCompanyId
    && String(targetCompany.parentCompanyId) === String(homeCtx.companyId)
  ) {
    return true;
  }
  return false;
}

function buildPlatformContext() {
  return {
    type: 'platform',
    companyId: null,
    companyName: 'NUMZ Platform',
    organizationType: null,
    parentCompanyId: null,
  };
}

function buildCompanyContext(company) {
  return {
    type: company.organizationType,
    companyId: company.id,
    companyName: company.name,
    organizationType: company.organizationType,
    parentCompanyId: company.parentCompanyId || null,
  };
}

/**
 * Read (never cache) any active-context override for this Traccar user and
 * apply it on top of their home context, re-validating authorization on every
 * call. Falls back to the home context (and self-heals by deleting the
 * override row) if the override is missing, stale, or no longer authorized.
 */
async function applyActiveContextOverride(homeCtx, traccarUserId) {
  const override = await ActiveContext.findByPk(traccarUserId);

  if (!override) {
    return homeCtx;
  }

  if (override.companyId == null) {
    if (homeCtx.isSuperAdmin) {
      // Explicit platform override — force platform regardless of whether
      // this identity also has a home company (homeCtx.companyId may be
      // non-null now that the two can coexist; the override must win).
      return {
        ...homeCtx,
        companyId: null,
        organizationType: null,
        parentCompanyId: null,
        companyName: null,
        accessibleCustomerIds: [],
      };
    }
    // Invalid: only a super admin may hold an explicit platform override.
    await override.destroy();
    return homeCtx;
  }

  const target = await Company.findByPk(override.companyId, {
    attributes: ['id', 'name', 'organizationType', 'parentCompanyId', 'status'],
  });

  if (!target || target.status !== 'active' || !canEnterCompanyContext(homeCtx, target)) {
    // Stale/invalid override (company deleted, deactivated, or access revoked).
    await override.destroy();
    return homeCtx;
  }

  const accessibleCustomerIds = target.organizationType === 'partner'
    ? await resolvePartnerAccessibleCustomers(target.id)
    : [];

  return {
    ...homeCtx,
    companyId: target.id,
    organizationType: target.organizationType,
    parentCompanyId: target.parentCompanyId || null,
    companyName: target.name,
    accessibleCustomerIds,
  };
}

/**
 * Resolve the full context (identity + active context) for a Traccar-authenticated
 * user. This is what req.auth is built from (see middleware/tenantContext.js).
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
      accessibleContexts: [],
      roles: [],
      isSuperAdmin: false,
    };
  }

  const homeCtx = await getHomeContext(traccarUser);
  const traccarUserId = Number(traccarUser.id);
  const resolved = await applyActiveContextOverride(homeCtx, traccarUserId);

  const activeContext = resolved.isSuperAdmin && resolved.companyId == null
    ? buildPlatformContext()
    : {
      type: resolved.organizationType || 'customer',
      companyId: resolved.companyId,
      companyName: resolved.companyName || null,
      parentCompanyId: resolved.parentCompanyId,
    };

  return {
    companyId: resolved.companyId, // Backward compat — the ACTIVE context's company
    homeCompanyId: resolved.homeCompanyId, // Identity fact — never changed by active context
    numzUserId: resolved.numzUserId,
    activeContext,
    organizationType: resolved.organizationType,
    accessibleCustomerIds: resolved.accessibleCustomerIds,
    accessibleContexts: resolved.accessibleContexts, // Identity fact — never changed by active context
    roles: resolved.roles,
    isSuperAdmin: resolved.isSuperAdmin, // Identity fact — never changed by active context
    numzRole: resolved.numzRole,
  };
}

/**
 * Switch the active context for this Traccar user to another organization.
 * Authoritative: independently determines whether the identity may enter the
 * requested company. Never trusts anything from the caller except the target ID.
 *
 * Pass targetCompanyId = null/undefined to switch into the platform context
 * (super admins only — see resetActiveContext for a generic "back to home").
 */
export async function switchActiveContext(traccarUser, targetCompanyId) {
  const homeCtx = await getHomeContext(traccarUser);
  const traccarUserId = Number(traccarUser.id);

  if (!targetCompanyId) {
    if (!homeCtx.isSuperAdmin) {
      const error = new Error('Only the platform administrator can switch into the platform context');
      error.statusCode = 403;
      throw error;
    }
    await ActiveContext.upsert({ traccarUserId, companyId: null });
    return buildPlatformContext();
  }

  const target = await Company.findByPk(targetCompanyId, {
    attributes: ['id', 'name', 'organizationType', 'parentCompanyId', 'status'],
  });

  if (!target) {
    const error = new Error('Company not found');
    error.statusCode = 404;
    throw error;
  }

  if (!canEnterCompanyContext(homeCtx, target)) {
    const error = new Error('You do not have access to this organization');
    error.statusCode = 403;
    throw error;
  }

  await ActiveContext.upsert({ traccarUserId, companyId: target.id });

  return buildCompanyContext(target);
}

/**
 * Reset this Traccar user's active context back to their default (home)
 * context — their own company if they have one (including a platform-capable
 * identity who also has a home company, per docs/PLATFORM_ARCHITECTURE.md's
 * identity-vs-context split), platform only for an identity with no home
 * company at all. This is the "back to platform"/"back to home" path
 * referenced in Phase 2D: it does not require the browser to reload the app.
 */
export async function resetActiveContext(traccarUser) {
  const traccarUserId = Number(traccarUser.id);
  await ActiveContext.destroy({ where: { traccarUserId } });

  const homeCtx = await getHomeContext(traccarUser);
  if (!homeCtx.homeCompanyId && homeCtx.isSuperAdmin) {
    return buildPlatformContext();
  }
  if (!homeCtx.companyId || homeCtx.companyId === DEFAULT_COMPANY_ID) {
    return {
      type: homeCtx.organizationType || 'customer',
      companyId: homeCtx.companyId,
      companyName: homeCtx.companyName,
      organizationType: homeCtx.organizationType,
      parentCompanyId: homeCtx.parentCompanyId,
    };
  }
  const company = await Company.findByPk(homeCtx.companyId, {
    attributes: ['id', 'name', 'organizationType', 'parentCompanyId'],
  });
  return company ? buildCompanyContext(company) : {
    type: homeCtx.organizationType || 'customer',
    companyId: homeCtx.companyId,
    companyName: homeCtx.companyName,
    organizationType: homeCtx.organizationType,
    parentCompanyId: homeCtx.parentCompanyId,
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

