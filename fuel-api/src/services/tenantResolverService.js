import { NumzUser, DEFAULT_COMPANY_ID } from '../models/index.js';

const companyCache = new Map();

/**
 * Resolve tenant company for a Traccar-authenticated user.
 * Falls back to default company until numz_users are provisioned.
 */
export async function resolveCompanyContextForTraccarUser(traccarUser) {
  if (!traccarUser?.id) {
    return {
      companyId: DEFAULT_COMPANY_ID,
      roles: [],
      isSuperAdmin: false,
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
  if (traccarUser.administrator && !numzUser?.companyId) {
    roles.push('super_admin');
  }
  if (traccarUser.administrator || traccarUser.isManager) {
    roles.push('company_admin', 'fleet_manager');
  }
  if (numzRole === 'technician') roles.push('technician');
  if (numzRole === 'dispatcher') roles.push('dispatcher');
  if (!traccarUser.administrator && !traccarUser.isManager) {
    roles.push('driver');
  }

  const ctx = {
    companyId: numzUser?.companyId || DEFAULT_COMPANY_ID,
    numzUserId: numzUser?.id || null,
    roles: [...new Set(roles)],
    isSuperAdmin: roles.includes('super_admin'),
    numzRole: numzRole || null,
  };

  companyCache.set(cacheKey, ctx);
  return ctx;
}

export function clearCompanyContextCache() {
  companyCache.clear();
}
