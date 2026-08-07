import { Role, UserRole } from '../../models/index.js';
import { traccarServiceFetch } from '../../services/traccarServiceClient.js';
import { ensureCompanyTraccarGroup } from '../../services/companyProvisioningService.js';
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

  const adminName = String(admin.name || '').trim();
  const adminEmail = String(admin.email || '').trim();
  const adminPassword = String(admin.password || '');
  if (!adminName) throw badRequest('admin.name is required');
  if (!adminEmail || !adminEmail.includes('@')) throw badRequest('admin.email must be a valid email');
  if (adminPassword.length < 6) throw badRequest('admin.password must be at least 6 characters');

  return {
    company: {
      name, slug, contactEmail: company.contactEmail || null, contactPhone: company.contactPhone || null,
    },
    admin: {
      name: adminName, email: adminEmail, phone: admin.phone || null, password: adminPassword,
    },
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
  // every new company's admin a platform-wide Traccar admin.
  const traccarUser = await traccarServiceFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({
      name: adminInput.name,
      email: adminInput.email,
      password: adminInput.password,
      administrator: false,
      attributes: { isManager: true },
    }),
  });

  const company = await repo.createCompanyDraft(companyInput);
  await ensureCompanyTraccarGroup(company.id);

  const numzUser = await repo.createNumzUserForAdmin({
    traccarUserId: traccarUser.id,
    email: adminInput.email,
    companyId: company.id,
  });

  const companyAdminRole = await Role.findOne({ where: { key: 'company_admin', companyId: null } });
  if (companyAdminRole) {
    await UserRole.findOrCreate({
      where: { numzUserId: numzUser.id, roleId: companyAdminRole.id, companyId: company.id },
    });
  }

  const activated = await repo.activateCompany(company.id);

  return {
    company: {
      id: activated.id, slug: activated.slug, name: activated.name, status: activated.status,
    },
    admin: {
      traccarUserId: traccarUser.id,
      name: adminInput.name,
      email: adminInput.email,
      // Returned once, here only — nothing stores this in plaintext beyond
      // this response. The platform owner is expected to hand it off
      // directly (see: no email-invite infra yet).
      temporaryPassword: adminInput.password,
    },
  };
}
