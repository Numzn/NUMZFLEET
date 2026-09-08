import { Company, CompanyDevice, NumzUser, DEFAULT_COMPANY_ID } from '../models/index.js';
import { traccarServiceFetch } from './traccarServiceClient.js';

export async function ensureCompanyTraccarGroup(companyId = DEFAULT_COMPANY_ID) {
  const company = await Company.findByPk(companyId);
  if (!company) {
    const err = new Error('Company not found');
    err.statusCode = 404;
    throw err;
  }
  if (company.traccarGroupId) return company;

  const group = await traccarServiceFetch('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name: `NumzTrak — ${company.name}` }),
  });
  await company.update({ traccarGroupId: group.id });
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
 * present and future. This is the missing half of ensureDeviceInCompany,
 * which only ever moved a device INTO the group, never granted any user
 * access TO it — so Traccar's own visibility never actually followed
 * company_id (Vehicle Visibility Audit, B3 / D1). Additive and best-effort:
 * failures are logged, never thrown, matching ensureDeviceInCompany's own
 * Traccar-sync error handling — repeat grants for the same {userId,groupId}
 * pair are expected (this runs on every provisioning touch, not once).
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

  try {
    await traccarServiceFetch('/api/permissions', {
      method: 'POST',
      body: JSON.stringify({ userId: uid, groupId: company.traccarGroupId }),
    });
  } catch (err) {
    console.warn('[companyProvisioning] Traccar user-group permission grant failed (non-fatal):', err?.message || err);
  }
}

/**
 * Reconciles every active, Traccar-linked numz_users row for a company into
 * that company's Traccar group. Call this whenever a company's device or
 * user roster changes, so Traccar's own ACL stays aligned with company_id
 * without requiring a perfect memory of every place a user could be added.
 * Additive only — grants membership, never revokes an existing Traccar
 * permission (cleanup of pre-existing tc_user_device/tc_user_group rows is a
 * deliberate, separate, human-reviewed step; see Vehicle Visibility Audit
 * Section E).
 */
export async function reconcileCompanyTraccarUsers(companyId) {
  if (!companyId) return { companyId, usersChecked: 0, granted: 0 };
  const users = await NumzUser.findAll({
    where: { companyId, status: 'active' },
  });

  let granted = 0;
  for (const user of users) {
    if (user.traccarUserId == null) continue;
    await ensureUserInCompanyTraccarGroup(companyId, user.traccarUserId);
    granted += 1;
  }
  return { companyId, usersChecked: users.length, granted };
}

export default {
  ensureCompanyTraccarGroup,
  ensureDeviceInCompany,
  ensureUserInCompanyTraccarGroup,
  reconcileCompanyTraccarUsers,
};
