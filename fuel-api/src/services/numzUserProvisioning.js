import { clearCompanyContextCache } from './tenantResolverService.js';
import {
  findByNumzUserId, findByTraccarUserId, createForTraccarUser, updateNumzUserFields,
} from '../modules/profile/profileRepository.js';

// A row created by someone else's role assignment (see
// modules/roles/rolesRepository.js) carries a placeholder email — nothing
// else ever touches it before this user actually logs in themselves. Once
// they do, Traccar's email is the real one; reconcile it here rather than
// leaving the placeholder stuck in numz_users indefinitely.
async function reconcileEmail(numzUser, traccarEmail) {
  if (traccarEmail && numzUser.email !== traccarEmail) {
    return updateNumzUserFields(numzUser.id, { email: traccarEmail });
  }
  return numzUser;
}

/**
 * numz_users rows are not provisioned anywhere else in the app today (see
 * docs/PLATFORM_ARCHITECTURE.md's noted gap: "provision all humans in numz_users").
 * Self-service provisioning on first touch of any numz_users-backed feature —
 * profile, notification preferences, or anything added later — so there's
 * always a row to attach data to, not just for users someone manually
 * inserted a row for. Extracted here (was profile-module-local) once a
 * second module needed the same "get or create my own numz_users row" logic.
 */
export async function ensureNumzUserRow(req) {
  if (req.auth?.numzUserId) {
    const existing = await findByNumzUserId(req.auth.numzUserId);
    if (existing) return reconcileEmail(existing, req.user.email);
  }

  const byTraccarId = await findByTraccarUserId(req.user.id);
  if (byTraccarId) {
    req.auth.numzUserId = byTraccarId.id;
    return reconcileEmail(byTraccarId, req.user.email);
  }

  const created = await createForTraccarUser({
    traccarUserId: req.user.id,
    email: req.user.email || `user${req.user.id}@fleet.local`,
    companyId: req.auth?.companyId || null,
  });
  clearCompanyContextCache();
  req.auth.numzUserId = created.id;
  return created;
}
