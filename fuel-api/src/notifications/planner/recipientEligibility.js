import { findByTraccarUserId } from '../../modules/profile/profileRepository.js';

/**
 * Whether this recipient may receive a notification at all — independent of
 * channel or preference. Two checks, both conservative: only suppress on
 * POSITIVE evidence of a problem, never on missing/ambiguous data, since a
 * false suppression silently drops a notification with no way for anyone to
 * notice.
 *
 * 1. Account status: a numz_users row that exists and is explicitly not
 *    'active' (e.g. suspended) is a real signal. No numz_users row at all is
 *    NOT a signal — most Traccar users still don't have one (the
 *    Default-Fleet legacy-fallback path, see ACCOUNTS_AND_TENANCY.md), and
 *    treating "unprovisioned" as "ineligible" would suppress most of the
 *    fleet's existing notification traffic.
 *
 * 2. Tenant/company match: only checked when the caller passes an
 *    `explicitCompanyId` — i.e. the producer itself is company-scoped
 *    (compliance, maintenance today), not the DEFAULT_COMPANY_ID fallback
 *    every other producer still uses. Only suppresses when the recipient's
 *    OWN home company is known and does not match — a platform-only identity
 *    (numz_users.company_id IS NULL) or an unprovisioned user is left alone,
 *    same reasoning as above. See PLATFORM_ARCHITECTURE.md's tenancy model.
 *
 * Deliberately NOT checked here: whether the recipient is a "manager" or has
 * the right role for this audience — that selection already happened in
 * audienceResolver.js before the planner ever sees a userId. This function
 * only answers "is this specific recipient in a state where ANY notification
 * should reach them", not "should they have been in the audience".
 *
 * @param {{ traccarUserId: number, companyId?: string|null, explicitCompanyId?: boolean }} args
 * @param {{ findUser?: typeof findByTraccarUserId }} [deps] Injection seam for
 *   tests only — every real call site uses the default.
 * @returns {Promise<{ eligible: true } | { eligible: false, reason: string }>}
 */
export async function checkRecipientEligibility({ traccarUserId, companyId, explicitCompanyId }, deps = {}) {
  const findUser = deps.findUser || findByTraccarUserId;
  const numzUser = await findUser(traccarUserId);
  if (!numzUser) return { eligible: true };

  if (numzUser.status && numzUser.status !== 'active') {
    return { eligible: false, reason: 'recipient_inactive' };
  }

  if (explicitCompanyId && companyId && numzUser.companyId && numzUser.companyId !== companyId) {
    return { eligible: false, reason: 'tenant_mismatch' };
  }

  return { eligible: true };
}
