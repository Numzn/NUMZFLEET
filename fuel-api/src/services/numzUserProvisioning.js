import { clearCompanyContextCache } from './tenantResolverService.js';
import {
  findByNumzUserId, findByTraccarUserId, createForTraccarUser,
} from '../modules/profile/profileRepository.js';

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
    if (existing) return existing;
  }

  const byTraccarId = await findByTraccarUserId(req.user.id);
  if (byTraccarId) {
    req.auth.numzUserId = byTraccarId.id;
    return byTraccarId;
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
