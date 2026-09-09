import { clearPermissionsCache } from '../../services/rolesService.js';
import { reconcileCompanyTraccarUsers } from '../../services/companyProvisioningService.js';
import * as repo from './rolesRepository.js';

function requireCompanyContext(req) {
  const companyId = req.auth?.companyId;
  if (!companyId) {
    const err = new Error('No organization context');
    err.statusCode = 403;
    throw err;
  }
  return companyId;
}

export async function listRoles() {
  return repo.listSystemRoles();
}

export async function listAssignments(req) {
  const companyId = requireCompanyContext(req);
  return repo.listRoleAssignmentsForCompany(companyId);
}

export async function assignRoleToUser(req) {
  const companyId = requireCompanyContext(req);
  const { traccarUserId, roleKey } = req.body || {};
  if (!traccarUserId || !roleKey) {
    const err = new Error('traccarUserId and roleKey are required');
    err.statusCode = 400;
    throw err;
  }

  const role = await repo.findRoleByKey(roleKey);
  if (!role) {
    const err = new Error(`Unknown role "${roleKey}"`);
    err.statusCode = 404;
    throw err;
  }
  if (role.key === 'platform_super_admin') {
    const err = new Error('Platform Super Admin cannot be assigned from Team Management');
    err.statusCode = 403;
    throw err;
  }

  // Placeholder email: identity for a Traccar user we haven't provisioned into
  // numz_users yet always comes from Traccar itself, not from this request —
  // matches ensureNumzUserRow()'s existing self-provisioning convention.
  const numzUser = await repo.ensureNumzUserForTraccarId(
    traccarUserId,
    companyId,
    `traccar-user-${traccarUserId}@placeholder.numzfleet.local`,
  );

  await repo.assignRole(numzUser.id, role.id, companyId);
  clearPermissionsCache(numzUser.id);

  // This is the "a user joins a company" moment — the only place today a
  // numz_user actually attaches to a company via the app (see
  // rolesRepository.ensureNumzUserForTraccarId, which refuses to silently
  // reattach a user already provisioned elsewhere). Their Traccar group
  // membership must follow immediately, not wait for the next unrelated
  // device assignment. Best-effort: a Traccar hiccup here must not fail the
  // role assignment, which has already succeeded in Postgres.
  try {
    await reconcileCompanyTraccarUsers(companyId);
  } catch (err) {
    console.warn('[assignRoleToUser] Traccar group reconciliation failed (non-fatal):', err?.message || err);
  }

  return repo.listRoleAssignmentsForCompany(companyId);
}

export async function removeRoleFromUser(req) {
  const companyId = requireCompanyContext(req);
  const { userRoleId } = req.params;

  const assignments = await repo.listRoleAssignmentsForCompany(companyId);
  const target = assignments.find((a) => a.userRoleId === userRoleId);
  if (!target) {
    const err = new Error('Role assignment not found');
    err.statusCode = 404;
    throw err;
  }

  // Invariant: a company must always retain at least one Company Admin, or
  // it locks itself out of Team Management entirely — see the RBAC design
  // discussion's CompanyMembership aggregate invariant.
  if (target.roleKey === 'company_admin') {
    const adminCount = assignments.filter((a) => a.roleKey === 'company_admin').length;
    if (adminCount <= 1) {
      const err = new Error('Cannot remove the last Company Admin.');
      err.statusCode = 409;
      throw err;
    }
  }

  await repo.removeRoleAssignment(userRoleId, companyId);
  clearPermissionsCache(target.numzUserId);
  return repo.listRoleAssignmentsForCompany(companyId);
}
