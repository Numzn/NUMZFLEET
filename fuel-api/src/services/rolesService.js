import { UserRole, Role, RolePermission, Permission } from '../models/index.js';

/**
 * backfillCompanyAdminRoles.js was a one-off script — it stamps company_admin
 * onto whoever was a Traccar administrator at the moment it ran, and nothing
 * re-runs it. A Traccar admin created or promoted afterward would show the
 * "Admin" badge with an empty permissions[] until someone remembers to re-run
 * the script. Close that gap the same way numz_users itself is provisioned
 * (see ensureNumzUserRow's "self-service on first touch" pattern) instead of
 * requiring an operator to notice and re-run a script. Company-scoped only —
 * a platform admin (companyId null) is intentionally left alone here, same
 * distinction tenantResolverService.js already draws between super_admin and
 * company_admin.
 */
async function ensureCompanyAdminRoleForTraccarAdmin(numzUserId, companyId) {
  if (!numzUserId || !companyId) return;
  const role = await Role.findOne({ where: { key: 'company_admin', companyId: null } });
  if (!role) return;
  await UserRole.findOrCreate({ where: { numzUserId, roleId: role.id, companyId } });
}

/**
 * Resolves a numz user's permissions for a given company (or platform-wide,
 * when companyId is null) into a flat array of permission keys — the one
 * function everything downstream should call, rather than each caller
 * re-implementing the user_roles → roles → role_permissions → permissions
 * walk on its own.
 *
 * Additive/read-only: nothing in the app gates on this yet (see
 * /api/me's `permissions` field, wired for observation only). Cached the
 * same way tenantResolverService.js already caches company context —
 * invalidate with clearPermissionsCache() from anywhere a role assignment
 * changes, exactly like clearCompanyContextCache() is called today from
 * profile/provisioning writes.
 */
const permissionsCache = new Map();

function cacheKey(numzUserId, companyId) {
  return `${numzUserId}:${companyId || 'platform'}`;
}

export async function resolvePermissionsForNumzUser(numzUserId, companyId, options = {}) {
  if (!numzUserId) return [];

  if (options.isTraccarAdmin) {
    await ensureCompanyAdminRoleForTraccarAdmin(numzUserId, companyId);
  }

  const key = cacheKey(numzUserId, companyId);
  if (permissionsCache.has(key)) return permissionsCache.get(key);

  const where = companyId ? { numzUserId, companyId } : { numzUserId, companyId: null };
  const userRoles = await UserRole.findAll({
    where,
    include: [{
      model: Role,
      include: [{
        model: RolePermission,
        include: [Permission],
      }],
    }],
  });

  const keys = new Set();
  for (const userRole of userRoles) {
    const rolePermissions = userRole.Role?.RolePermissions || [];
    for (const rolePermission of rolePermissions) {
      if (rolePermission.Permission?.key) keys.add(rolePermission.Permission.key);
    }
  }

  const result = [...keys];
  permissionsCache.set(key, result);
  return result;
}

export function clearPermissionsCache(numzUserId) {
  for (const key of permissionsCache.keys()) {
    if (key.startsWith(`${numzUserId}:`)) permissionsCache.delete(key);
  }
}
