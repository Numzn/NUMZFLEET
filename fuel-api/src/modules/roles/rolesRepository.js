import {
  Role, Permission, RolePermission, UserRole, NumzUser,
} from '../../models/index.js';
import { findByTraccarUserId, createForTraccarUser } from '../profile/profileRepository.js';

export async function listSystemRoles() {
  const roles = await Role.findAll({
    where: { companyId: null },
    include: [{ model: RolePermission, include: [Permission] }],
    order: [['key', 'ASC']],
  });
  return roles.map((role) => ({
    id: role.id,
    key: role.key,
    label: role.label,
    permissions: (role.RolePermissions || [])
      .map((rp) => rp.Permission)
      .filter(Boolean)
      .map((p) => ({ key: p.key, category: p.category, description: p.description })),
  }));
}

export async function ensureNumzUserForTraccarId(traccarUserId, companyId, email) {
  const existing = await findByTraccarUserId(traccarUserId);
  if (existing) {
    // Never silently reattach a user already provisioned into another
    // company — that would leave numz_users.company_id and this new
    // user_roles.company_id disagreeing about which tenant owns them.
    if (existing.companyId && companyId && existing.companyId !== companyId) {
      const err = new Error('This user belongs to a different company');
      err.statusCode = 409;
      throw err;
    }
    return existing;
  }
  return createForTraccarUser({ traccarUserId, email, companyId });
}

export async function listRoleAssignmentsForCompany(companyId) {
  const assignments = await UserRole.findAll({
    where: { companyId },
    include: [{ model: Role }, { model: NumzUser }],
    order: [['created_at', 'ASC']],
  });
  return assignments.map((a) => ({
    userRoleId: a.id,
    numzUserId: a.numzUserId,
    traccarUserId: a.NumzUser?.traccarUserId,
    roleId: a.roleId,
    roleKey: a.Role?.key,
    roleLabel: a.Role?.label,
  }));
}

export async function findRoleByKey(key) {
  return Role.findOne({ where: { key, companyId: null } });
}

export async function assignRole(numzUserId, roleId, companyId) {
  const [row] = await UserRole.findOrCreate({
    where: {
      numzUserId, roleId, companyId,
    },
  });
  return row;
}

export async function removeRoleAssignment(userRoleId, companyId) {
  const row = await UserRole.findOne({ where: { id: userRoleId, companyId } });
  if (!row) return null;
  await row.destroy();
  return row;
}
