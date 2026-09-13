import { v4 as uuid } from 'uuid';
import { NumzUser, Role, UserRole } from '../../models/index.js';
import { traccarServiceFetch } from '../../services/traccarServiceClient.js';
import { reconcileCompanyTraccarUsers } from '../../services/companyProvisioningService.js';

/**
 * The exact fields PeopleSection.jsx (and the role/status derivation it uses —
 * traccar-fleet-system/frontend/src/common/util/personRoles.js) reads from a
 * Traccar user object, plus `phone` for PersonProfileTab/PersonOverviewTab.
 * Whitelisted explicitly rather than passed through whole: Traccar's
 * /api/users response also carries totpKey (a live 2FA secret, per
 * SecuritySection.jsx's own use of GET /api/users/:id) among other fields
 * nothing here needs. These endpoints are new, not a proxy — there is no
 * reason to forward more than the frontend already consumes.
 */
export const PERSON_FIELDS = [
  'id', 'name', 'email', 'phone', 'administrator', 'isManager', 'attributes', 'disabled', 'expirationTime', 'temporary',
];

export function selectPersonFields(traccarUser) {
  const selected = {};
  for (const field of PERSON_FIELDS) {
    selected[field] = traccarUser[field] ?? (field === 'attributes' ? {} : null);
  }
  return selected;
}

/** Fields a caller may change via PATCH — never `id`, and never anything not in PERSON_FIELDS's own write-relevant subset. */
const PATCHABLE_FIELDS = ['name', 'email', 'phone', 'administrator', 'disabled', 'attributes', 'expirationTime'];

function requireCompanyId(req) {
  const companyId = req.auth?.companyId;
  if (!companyId) {
    const err = new Error('No organization context');
    err.statusCode = 403;
    throw err;
  }
  return companyId;
}

/** The one ownership check every read/write below shares: does this Traccar id belong to the caller's own company? */
async function requireOwnedPerson(companyId, traccarUserId) {
  const numzUser = await NumzUser.findOne({ where: { companyId, traccarUserId: Number(traccarUserId) } });
  if (!numzUser) {
    const err = new Error('Person not found');
    err.statusCode = 404;
    throw err;
  }
  return numzUser;
}

/**
 * Company-scoped People list.
 *
 * Tenant is derived from req.auth.companyId only — set by
 * middleware/tenantContext.js from the authenticated session, never from
 * anything the client supplies. Matches modules/roles/rolesService.js's
 * requireCompanyContext, the sibling module this one is deliberately shaped
 * to resemble.
 *
 * numz_users has no administrator/isManager/attributes/disabled/expirationTime
 * columns — those are what PeopleSection's role and status chips are derived
 * from, and they live only on the Traccar user object. So this resolves
 * *scope* (which Traccar ids belong to this company) from Postgres, then
 * fetches those ids' *display* data from Traccar server-side — the same data
 * PeopleSection already fetched client-side, just filtered before it ever
 * reaches the browser instead of after.
 *
 * A Traccar user with no numz_users row is deliberately excluded, not guessed
 * into whichever company happens to be asking — see
 * docs/TENANCY_ARCHITECTURE.md §2 ("a resource with no reliable company
 * relationship must not be guessed at"). It is a real, named gap (fewer
 * people than the old unscoped list showed), not a silent one — see
 * createCompanyPerson below for the flow that actually closes it going
 * forward.
 */
export async function listCompanyPeople(req) {
  const companyId = requireCompanyId(req);

  const numzUsers = await NumzUser.findAll({
    where: { companyId },
    attributes: ['traccarUserId'],
  });
  const allowedIds = new Set(
    numzUsers.map((u) => u.traccarUserId).filter((id) => id != null),
  );
  if (allowedIds.size === 0) return [];

  const traccarUsers = await traccarServiceFetch('/api/users');
  return traccarUsers
    .filter((u) => allowedIds.has(u.id))
    .map(selectPersonFields);
}

/**
 * One company-scoped person. Same ownership check as every write below
 * (requireOwnedPerson) — a Traccar id that isn't this company's own numz_users
 * row reads as 404, not 403, so an id's mere existence in another company is
 * never disclosed.
 */
export async function getCompanyPerson(req, traccarUserId) {
  const companyId = requireCompanyId(req);
  await requireOwnedPerson(companyId, traccarUserId);
  const traccarUser = await traccarServiceFetch(`/api/users/${traccarUserId}`);
  return selectPersonFields(traccarUser);
}

/**
 * Creates a person: a Traccar account (so they can actually sign in — NumzTrak
 * native login is not enabled yet, see auth/loginController.js) plus a
 * numz_users row scoped to the caller's own company, as one action instead of
 * the old two-step path (create via the raw Traccar form, then wait for a
 * role assignment to incidentally provision numz_users — see
 * rolesRepository.ensureNumzUserForTraccarId). This is the flow that actually
 * prevents the "Traccar-only person" gap listCompanyPeople works around,
 * rather than just working around it.
 *
 * Orphan prevention: if the numz_users insert fails after the Traccar user
 * was created, the Traccar user is deleted rather than left dangling with no
 * company record — best-effort, logged if the compensating delete itself
 * fails, but never allowed to mask the original error.
 */
export async function createCompanyPerson(req) {
  const companyId = requireCompanyId(req);
  const { name, email, phone, password } = req.body || {};
  if (!name || !String(name).trim()) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  if (!email || !String(email).trim()) {
    const err = new Error('email is required');
    err.statusCode = 400;
    throw err;
  }
  if (!password || String(password).length < 8) {
    const err = new Error('password is required and must be at least 8 characters');
    err.statusCode = 400;
    throw err;
  }

  const traccarUser = await traccarServiceFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({
      name: String(name).trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : undefined,
      password: String(password),
      administrator: false,
    }),
  });

  try {
    await NumzUser.create({
      id: uuid(),
      traccarUserId: traccarUser.id,
      companyId,
      email: String(email).trim(),
      displayName: String(name).trim(),
      status: 'active',
    });
  } catch (err) {
    console.warn('[peopleService] numz_users insert failed after Traccar user create — deleting orphan Traccar user', traccarUser.id, err?.message || err);
    await traccarServiceFetch(`/api/users/${traccarUser.id}`, { method: 'DELETE' }).catch((cleanupErr) => {
      console.error('[peopleService] failed to delete orphaned Traccar user', traccarUser.id, cleanupErr?.message || cleanupErr);
    });
    throw err;
  }

  // Same "join the company's Traccar group immediately" step
  // modules/roles/rolesService.js's assignRoleToUser already does for the
  // other path a person can be first provisioned through — best-effort, a
  // Traccar hiccup here must not fail a creation that already succeeded in
  // Postgres.
  try {
    await reconcileCompanyTraccarUsers(companyId);
  } catch (err) {
    console.warn('[createCompanyPerson] Traccar group reconciliation failed (non-fatal):', err?.message || err);
  }

  return selectPersonFields(traccarUser);
}

/**
 * Updates a company-owned person. Whole-object semantics against Traccar
 * (same convention personApi.js's old updatePerson documented — "callers
 * must pass the record they loaded with their edits merged in"), but only
 * PATCHABLE_FIELDS from the request body are actually applied — the current
 * Traccar object is fetched first and used as the base, so fields this API
 * doesn't expose (totpKey, deviceLimit, ...) are preserved unchanged rather
 * than clearable by omission.
 */
export async function updateCompanyPerson(req, traccarUserId) {
  const companyId = requireCompanyId(req);
  const numzUser = await requireOwnedPerson(companyId, traccarUserId);

  const current = await traccarServiceFetch(`/api/users/${traccarUserId}`);
  const merged = { ...current };
  const body = req.body || {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) merged[field] = body[field];
  }

  const updated = await traccarServiceFetch(`/api/users/${traccarUserId}`, {
    method: 'PUT',
    body: JSON.stringify(merged),
  });

  // Keep numz_users' own copies of email/displayName in step with the
  // Traccar-side change that just succeeded, same reconciliation
  // numzUserProvisioning.js's reconcileEmail already does on first login.
  const fieldsToSync = {};
  if (typeof merged.email === 'string' && merged.email !== numzUser.email) fieldsToSync.email = merged.email;
  if (typeof merged.name === 'string' && merged.name !== numzUser.displayName) fieldsToSync.displayName = merged.name;
  if (Object.keys(fieldsToSync).length) await numzUser.update(fieldsToSync);

  return selectPersonFields(updated);
}

/**
 * Deletes a company-owned person: removes the Traccar account (the same hard
 * delete PeopleSection.jsx's trash icon triggers, via this module's own
 * deletePerson rather than a Traccar-direct endpoint) and the numz_users row.
 * UserRole rows cascade on the numz_users delete (FK
 * ON DELETE CASCADE, see migrations/20260731_roles_permissions_foundation.sql)
 * — if that would remove the company's last company_admin, this is refused
 * first, the same invariant modules/roles/rolesService.js's
 * removeRoleFromUser already enforces for a direct role removal, so deleting
 * a person can't be used to route around it.
 */
export async function deleteCompanyPerson(req, traccarUserId) {
  const companyId = requireCompanyId(req);
  const numzUser = await requireOwnedPerson(companyId, traccarUserId);

  const adminRole = await Role.findOne({ where: { key: 'company_admin', companyId: null } });
  if (adminRole) {
    const holdsAdmin = await UserRole.findOne({
      where: { numzUserId: numzUser.id, roleId: adminRole.id, companyId },
    });
    if (holdsAdmin) {
      const adminCount = await UserRole.count({ where: { roleId: adminRole.id, companyId } });
      if (adminCount <= 1) {
        const err = new Error('Cannot delete the last Company Admin.');
        err.statusCode = 409;
        throw err;
      }
    }
  }

  await traccarServiceFetch(`/api/users/${traccarUserId}`, { method: 'DELETE' });
  await numzUser.destroy();
  return { deleted: true };
}
