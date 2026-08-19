import { traccarServiceFetch, verifyTraccarCredentials } from '../../services/traccarServiceClient.js';
import { clearCompanyContextCache } from '../../services/tenantResolverService.js';
import { buildProfileAvatarPath } from '../../middleware/profileUpload.js';
import { listLoginHistoryForUser } from '../../services/loginAuditService.js';
import { ensureNumzUserRow } from '../../services/numzUserProvisioning.js';
import { resolvePermissionsForNumzUser } from '../../services/rolesService.js';
import * as repo from './profileRepository.js';

// req.user (from the auth middleware) never carries `phone`/`attributes`/`map`/
// `coordinateFormat` — every session-validation path in userService.js narrows
// the Traccar row down to {id, name, email, administrator, readonly, isManager,
// isDriver} before returning it. Reads must go back to Traccar's full user
// record instead of trusting req.user for anything beyond identity.
async function fetchTraccarUser(req) {
  return traccarServiceFetch(`/api/users/${req.user.id}`);
}

function toProfileDto(traccarUser, numzUser, permissions) {
  return {
    id: traccarUser.id,
    name: traccarUser.name || null,
    email: traccarUser.email || null,
    phone: traccarUser.phone || null,
    map: traccarUser.map || null,
    coordinateFormat: traccarUser.coordinateFormat || null,
    attributes: traccarUser.attributes || {},
    avatarUrl: numzUser?.avatarUrl || null,
    jobTitle: numzUser?.jobTitle || null,
    department: numzUser?.department || null,
    defaultDashboard: numzUser?.defaultDashboard || null,
    // Observation-only for now — nothing gates on this yet (see the
    // roles/permissions foundation work). Exposed here so the new
    // user_roles-driven system is checkable against real requests before
    // any authGates.js check is cut over to trust it.
    permissions,
  };
}

export async function getMe(req) {
  const [traccarUser, numzUser] = await Promise.all([
    fetchTraccarUser(req),
    ensureNumzUserRow(req),
  ]);
  const permissions = await resolvePermissionsForNumzUser(numzUser?.id, req.auth?.companyId, {
    isTraccarAdmin: !!req.user?.administrator,
    homeCompanyId: req.auth?.homeCompanyId,
  });
  return toProfileDto(traccarUser, numzUser, permissions);
}

export async function patchMe(req) {
  const body = req.body || {};
  const numzUser = await ensureNumzUserRow(req);

  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const email = body.email !== undefined ? String(body.email).trim() : undefined;
  if (name !== undefined && !name) {
    const err = new Error('name cannot be empty');
    err.statusCode = 400;
    throw err;
  }
  if (email !== undefined && !email) {
    const err = new Error('email cannot be empty');
    err.statusCode = 400;
    throw err;
  }

  const touchesTraccar = name !== undefined || email !== undefined || body.phone !== undefined
    || body.map !== undefined || body.coordinateFormat !== undefined || body.attributes !== undefined;

  // Traccar-owned fields: write through server-side. Traccar stays the source of
  // truth for login identity — the frontend never talks to Traccar directly for this.
  let traccarUser;
  if (touchesTraccar) {
    const current = await traccarServiceFetch(`/api/users/${req.user.id}`);
    // A merge (not a wholesale replace) so a partial PATCH never clobbers
    // unrelated attributes — but that means "clear this attribute" can't be
    // expressed by omitting the key (an omitted key just leaves the old value
    // in place). Callers signal "clear" with an explicit `null`, which this
    // deletes from the merged object — e.g. resetting theme to "auto" removes
    // `darkMode` entirely rather than merging in a `null` value, which
    // AppThemeProvider.jsx's `!== undefined` check would otherwise treat as
    // an explicit (falsy/light) preference rather than "no preference set".
    const nextAttributes = { ...current.attributes };
    if (body.attributes !== undefined) {
      Object.entries(body.attributes).forEach(([key, value]) => {
        if (value === null) {
          delete nextAttributes[key];
        } else {
          nextAttributes[key] = value;
        }
      });
    }
    traccarUser = await traccarServiceFetch(`/api/users/${req.user.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...current,
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
        ...(body.map !== undefined ? { map: body.map || null } : {}),
        ...(body.coordinateFormat !== undefined ? { coordinateFormat: body.coordinateFormat || null } : {}),
        attributes: nextAttributes,
      }),
    });
    req.user = { ...req.user, ...traccarUser };
  } else {
    traccarUser = await fetchTraccarUser(req);
  }

  // NUMZFLEET-native fields: stored directly, no Traccar concept of these exists.
  const nativePatch = {};
  if (body.jobTitle !== undefined) nativePatch.jobTitle = body.jobTitle || null;
  if (body.department !== undefined) nativePatch.department = body.department || null;
  if (body.defaultDashboard !== undefined) nativePatch.defaultDashboard = body.defaultDashboard || null;

  let finalNumzUser = numzUser;
  if (Object.keys(nativePatch).length) {
    finalNumzUser = await repo.updateNumzUserFields(numzUser.id, nativePatch);
    clearCompanyContextCache();
  }

  const permissions = await resolvePermissionsForNumzUser(finalNumzUser?.id, req.auth?.companyId, {
    isTraccarAdmin: !!req.user?.administrator,
    homeCompanyId: req.auth?.homeCompanyId,
  });
  return toProfileDto(traccarUser, finalNumzUser, permissions);
}

export async function changePassword(req) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    const err = new Error('currentPassword and newPassword are required');
    err.statusCode = 400;
    throw err;
  }
  if (String(newPassword).length < 6) {
    const err = new Error('newPassword must be at least 6 characters');
    err.statusCode = 400;
    throw err;
  }

  // The legacy settings/UserPage.jsx password field never verified the current
  // password at all (Traccar's admin API has no such check built in) — this is
  // a real security improvement, not parity with the old flow.
  const verified = await verifyTraccarCredentials(req.user.email, currentPassword);
  if (!verified) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 401;
    throw err;
  }

  const current = await traccarServiceFetch(`/api/users/${req.user.id}`);
  await traccarServiceFetch(`/api/users/${req.user.id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...current, password: newPassword }),
  });

  return { ok: true };
}

export async function getLoginHistory(req) {
  return listLoginHistoryForUser(req.user.id, req.user.email, req.query || {});
}

export async function patchAvatar(req) {
  const numzUser = await ensureNumzUserRow(req);
  if (!req.file) {
    const err = new Error('avatar file is required');
    err.statusCode = 400;
    throw err;
  }
  const avatarUrl = buildProfileAvatarPath(req.file.filename);
  const updated = await repo.updateNumzUserFields(numzUser.id, { avatarUrl });
  clearCompanyContextCache();
  const traccarUser = await fetchTraccarUser(req);
  const permissions = await resolvePermissionsForNumzUser(updated?.id, req.auth?.companyId, {
    isTraccarAdmin: !!req.user?.administrator,
    homeCompanyId: req.auth?.homeCompanyId,
  });
  return toProfileDto(traccarUser, updated, permissions);
}
