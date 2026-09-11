import { Op } from 'sequelize';
import { Company, CompanyDevice, NumzUser, DEFAULT_COMPANY_ID } from '../models/index.js';
import { traccarServiceFetch } from './traccarServiceClient.js';
import { runTraccarQuery } from '../config/traccar.js';
import {
  markAclSyncAttempt,
  markAclSyncSuccess,
  markAclSyncFailure,
} from './traccarAclSyncStatus.js';

/**
 * Does this group still exist in Traccar? Read-only, straight against Traccar's
 * MySQL — the same pattern currentTraccarGroupMemberIds uses below. Deliberately
 * not an API call: it needs no Traccar permission, so a stale id is still
 * detectable even when the service identity has lost access to the group.
 */
async function traccarGroupExists(groupId) {
  const rows = await runTraccarQuery('SELECT id FROM tc_groups WHERE id = ?', [groupId]);
  return rows.length > 0;
}

/**
 * Is this group id already claimed by a different company? One company = one
 * group and one group = one company (docs/TENANCY_ARCHITECTURE.md §2), so a
 * contested id means the stored value is wrong, never that the group is shared.
 */
async function groupClaimedByAnotherCompany(groupId, companyId) {
  const other = await Company.findOne({
    where: { traccarGroupId: groupId, id: { [Op.ne]: companyId } },
    attributes: ['id'],
  });
  return other?.id || null;
}

/** Creates this company's own Traccar group and returns its id. */
async function createCompanyTraccarGroup(company) {
  const group = await traccarServiceFetch('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name: `NumzTrak — ${company.name}` }),
  });
  return group.id;
}

/**
 * Resolve the company's own Traccar group, creating it if there isn't a usable
 * one. A stored id is no longer trusted on sight: a group deleted in Traccar
 * sets tc_devices.groupid to NULL and cascades away every tc_user_group row,
 * while companies.traccar_group_id keeps pointing at the dead id forever — so
 * every later grant, revoke and device move silently targets nothing.
 *
 * A stored id is used only when it both still exists and is not claimed by
 * another company. Otherwise a fresh group is created for this company, which
 * by construction cannot belong to anyone else.
 *
 * `deps` exists so the decision can be tested without a live Traccar — see
 * companyGroupIntegrity.test.js. Production always uses the real implementations.
 */
export async function ensureCompanyTraccarGroup(companyId = DEFAULT_COMPANY_ID, deps = {}) {
  const {
    groupExists = traccarGroupExists,
    claimedByAnother = groupClaimedByAnotherCompany,
    createGroup = createCompanyTraccarGroup,
  } = deps;

  const company = await Company.findByPk(companyId);
  if (!company) {
    const err = new Error('Company not found');
    err.statusCode = 404;
    throw err;
  }

  if (company.traccarGroupId) {
    const stored = company.traccarGroupId;

    const otherCompanyId = await claimedByAnother(stored, company.id);
    if (otherCompanyId) {
      console.warn(`[companyProvisioning] company ${company.id} stored Traccar group ${stored}, but it is claimed by company ${otherCompanyId} — creating a dedicated group instead`);
    } else {
      let exists;
      try {
        exists = await groupExists(stored);
      } catch (err) {
        // Traccar unreachable is not evidence the group is gone. Recreating on
        // a transient failure would spawn a duplicate group on every blip, so
        // keep the stored id and let the caller's own error handling apply.
        console.warn('[companyProvisioning] could not verify Traccar group existence (keeping stored id):', err?.message || err);
        return company;
      }
      if (exists) return company;
      console.warn(`[companyProvisioning] company ${company.id} stored Traccar group ${stored}, which no longer exists — recreating`);
    }
  }

  const groupId = await createGroup(company);
  await company.update({ traccarGroupId: groupId });
  return company;
}

export async function ensureDeviceInCompany(companyId, traccarDeviceId, vehicleId = null) {
  const company = await ensureCompanyTraccarGroup(companyId);
  const did = Number(traccarDeviceId);
  if (!Number.isFinite(did)) return;

  const device = await traccarServiceFetch(`/api/devices/${did}`);
  if (device?.groupId !== company.traccarGroupId) {
    await traccarServiceFetch(`/api/devices/${did}`, {
      method: 'PUT',
      body: JSON.stringify({ ...device, groupId: company.traccarGroupId }),
    });
  }

  await CompanyDevice.findOrCreate({
    where: { traccarDeviceId: did },
    defaults: {
      companyId,
      traccarDeviceId: did,
      vehicleId: vehicleId || null,
      isActive: true,
    },
  }).then(async ([row]) => {
    await row.update({
      companyId,
      vehicleId: vehicleId || null,
      isActive: true,
    });
  });
}

/**
 * Grants a Traccar user access to a company's Traccar group — Traccar's own
 * group-permission inheritance then covers every device in that group,
 * present and future. Low-level, single-direction primitive: use
 * reconcileCompanyTraccarUsers for anything that also needs to revoke stale
 * membership. Best-effort: failures are logged, never thrown, matching
 * ensureDeviceInCompany's own Traccar-sync error handling.
 */
async function grantUserTraccarGroupAccess(traccarGroupId, traccarUserId) {
  markAclSyncAttempt();
  try {
    await traccarServiceFetch('/api/permissions', {
      method: 'POST',
      body: JSON.stringify({ userId: traccarUserId, groupId: traccarGroupId }),
    });
    markAclSyncSuccess();
    return true;
  } catch (err) {
    markAclSyncFailure(err);
    console.warn('[companyProvisioning] Traccar user-group grant failed (non-fatal):', err?.message || err);
    return false;
  }
}

/** Companion revoke — same best-effort contract as the grant above. */
async function revokeUserTraccarGroupAccess(traccarGroupId, traccarUserId) {
  markAclSyncAttempt();
  try {
    await traccarServiceFetch('/api/permissions', {
      method: 'DELETE',
      body: JSON.stringify({ userId: traccarUserId, groupId: traccarGroupId }),
    });
    markAclSyncSuccess();
    return true;
  } catch (err) {
    markAclSyncFailure(err);
    console.warn('[companyProvisioning] Traccar user-group revoke failed (non-fatal):', err?.message || err);
    return false;
  }
}

/**
 * Convenience single-user grant, used by the "provision one new admin"
 * call site where there's no broader roster to reconcile against yet.
 */
export async function ensureUserInCompanyTraccarGroup(companyId, traccarUserId) {
  const uid = Number(traccarUserId);
  if (!Number.isFinite(uid)) return;
  let company;
  try {
    company = await ensureCompanyTraccarGroup(companyId);
  } catch (err) {
    console.warn('[companyProvisioning] could not ensure Traccar group before user grant (non-fatal):', err?.message || err);
    return;
  }
  if (!company.traccarGroupId) return;
  await grantUserTraccarGroupAccess(company.traccarGroupId, uid);
}

/**
 * Who does Traccar currently think belongs to this group? Read-only, direct
 * against Traccar's own MySQL (same pattern as
 * integrations/traccarBridge/deviceAudienceResolver.js) — traccarServiceFetch
 * has no "list members of a group" endpoint, only per-pair grant/revoke.
 */
async function currentTraccarGroupMemberIds(traccarGroupId) {
  const rows = await runTraccarQuery(
    'SELECT userid FROM tc_user_group WHERE groupid = ?',
    [traccarGroupId],
  );
  return new Set(rows.map((r) => Number(r.userid)));
}

/**
 * Self-contained administrator check via runTraccarQuery — deliberately not
 * userService.js's getTraccarUser, which reads through the shared,
 * long-lived getTraccarPool(). That pool is correct for the server process
 * that's expected to hold it open for its whole lifetime, but every other
 * caller (any short-lived script or test process) needs to remember to
 * close it or the process never exits — found the hard way when this exact
 * check, first written against getTraccarUser, hung an unrelated
 * pre-existing test file that had no idea this pool now existed. Keeping
 * every Traccar-MySQL read in this file on the same one-off-connection
 * helper avoids the whole class of bug.
 */
async function isTraccarAdministrator(traccarUserId) {
  const rows = await runTraccarQuery(
    'SELECT administrator FROM tc_users WHERE id = ?',
    [traccarUserId],
  );
  return rows.length > 0 && !!rows[0].administrator;
}

/**
 * Reconciles a company's Traccar group membership to exactly the set of its
 * own active, Traccar-linked numz_users — granting whoever is missing AND
 * revoking whoever no longer belongs. This is the mechanism that makes
 * company visibility actually follow the company when a user joins, leaves,
 * or moves companies (Vehicle Visibility Audit follow-up: additive-only
 * grants left stale access behind — see the original D1 docstring this
 * replaces). Only ever touches tc_user_group membership for THIS company's
 * group; it never reads or writes tc_user_device, so pre-existing
 * manually-configured direct device permissions are left completely alone.
 */
export async function reconcileCompanyTraccarUsers(companyId) {
  if (!companyId) return { companyId, usersChecked: 0, granted: 0, revoked: 0 };

  let company;
  try {
    company = await ensureCompanyTraccarGroup(companyId);
  } catch (err) {
    console.warn('[companyProvisioning] could not ensure Traccar group before reconcile (non-fatal):', err?.message || err);
    return { companyId, usersChecked: 0, granted: 0, revoked: 0 };
  }
  if (!company.traccarGroupId) return { companyId, usersChecked: 0, granted: 0, revoked: 0 };

  const activeUsers = await NumzUser.findAll({ where: { companyId, status: 'active' } });
  const desiredIds = new Set(
    activeUsers.map((u) => u.traccarUserId).filter((id) => Number.isFinite(id)),
  );

  let currentIds;
  try {
    currentIds = await currentTraccarGroupMemberIds(company.traccarGroupId);
  } catch (err) {
    console.warn('[companyProvisioning] could not read current Traccar group membership (non-fatal, skipping reconcile):', err?.message || err);
    return { companyId, usersChecked: activeUsers.length, granted: 0, revoked: 0 };
  }

  const toGrant = [...desiredIds].filter((id) => !currentIds.has(id));
  const revokeCandidates = [...currentIds].filter((id) => !desiredIds.has(id));

  // Discovered empirically: Traccar auto-adds every administrator account to
  // a group's tc_user_group the moment the group is created — a real,
  // persisted row, not just a runtime bypass. An administrator's Live Map
  // visibility comes from the administrator flag itself, never from group
  // membership, so this row grants them nothing; but reconciling THIS
  // company's own roster is not the place to touch it either way — company
  // visibility and platform administration must stay separate concerns (see
  // the isSuperAdmin/administrator decoupling in tenantResolverService.js).
  // Revoking it would still be harmless today, but would silently start
  // mattering the moment any account's admin status changes without this
  // function's knowledge — so leave every administrator's row alone,
  // unconditionally, rather than depend on that always staying true.
  const toRevoke = [];
  for (const id of revokeCandidates) {
    const isAdmin = await isTraccarAdministrator(id).catch(() => false);
    if (!isAdmin) toRevoke.push(id);
  }

  let granted = 0;
  for (const uid of toGrant) {
    if (await grantUserTraccarGroupAccess(company.traccarGroupId, uid)) granted += 1;
  }
  let revoked = 0;
  for (const uid of toRevoke) {
    if (await revokeUserTraccarGroupAccess(company.traccarGroupId, uid)) revoked += 1;
  }

  return {
    companyId, usersChecked: activeUsers.length, granted, revoked,
  };
}

export default {
  ensureCompanyTraccarGroup,
  ensureDeviceInCompany,
  ensureUserInCompanyTraccarGroup,
  reconcileCompanyTraccarUsers,
};
