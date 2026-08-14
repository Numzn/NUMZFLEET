import { ensureCompanyTraccarGroup } from '../../services/companyProvisioningService.js';
import { provisionCompanyAdmin } from '../../services/organizationProvisioningService.js';
import * as repo from './companiesRepository.js';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function validateInput(body) {
  const company = body?.company || {};
  const admin = body?.admin || {};

  const name = String(company.name || '').trim();
  const slug = String(company.slug || '').trim().toLowerCase();
  if (!name) throw badRequest('company.name is required');
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw badRequest('company.slug is required and must be lowercase letters, numbers, and hyphens only');
  }

  return {
    company: {
      name, slug, contactEmail: company.contactEmail || null, contactPhone: company.contactPhone || null,
    },
    admin,
  };
}

export async function listCompanies() {
  return repo.listCompanies();
}

/**
 * MVP orchestration for docs/PLATFORM_ARCHITECTURE.md's CompanyProvisioningService
 * target (create company -> provision resources -> create first admin -> activate).
 * Email invitations, provisioning events, and custom role templates are
 * explicitly out of scope for this slice — see the RBAC/onboarding design
 * discussion this was built against.
 *
 * Ordering favors "fail before writing anything" over transactional rollback
 * across Traccar (an external system Postgres can't roll back): the Traccar
 * admin account is created first, since if that fails nothing else has
 * happened yet. If a later Postgres-only step fails, the company may be left
 * in 'provisioning' status with a real but unlinked Traccar user — a known,
 * documented gap for this MVP, not silently swallowed.
 *
 * Phase 2 consolidation (Stage 1): the admin-creation + Traccar-group steps
 * are now shared with the SaaS Partner/Direct-Customer workflow via
 * services/organizationProvisioningService.js — same behavior as before,
 * just no longer duplicated in two places.
 */
export async function provisionCompany(req) {
  const { company: companyInput, admin: adminInput } = validateInput(req.body);

  const existing = await repo.findCompanyBySlug(companyInput.slug);
  if (existing) {
    const err = new Error(`Company slug "${companyInput.slug}" is already in use`);
    err.statusCode = 409;
    throw err;
  }

  // Company admin gets Traccar attributes.isManager, not administrator — the
  // latter is a global Traccar flag with no tenant boundary (see
  // roleFlagsFromTraccar in userService.js). Granting it here would make
  // every new company's admin a platform-wide Traccar admin. (Enforced inside
  // provisionCompanyAdmin — see organizationProvisioningService.js.)
  const company = await repo.createCompanyDraft(companyInput);
  await ensureCompanyTraccarGroup(company.id);

  const provisionedAdmin = await provisionCompanyAdmin({ companyId: company.id, admin: adminInput });

  const activated = await repo.activateCompany(company.id);

  return {
    company: {
      id: activated.id, slug: activated.slug, name: activated.name, status: activated.status,
    },
    admin: provisionedAdmin,
  };
}

