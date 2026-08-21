/**
 * Organization Provisioning Service (Phase 2 consolidation, Stage 1)
 *
 * Extracted from fuel-api/src/modules/platform/companiesService.js — the
 * "Company Provisioning" workflow's admin-creation + Traccar-group steps,
 * made reusable so the SaaS Partner/Direct-Customer/Partner-Customer
 * workflow (organizationService.js) can offer the exact same capability
 * without a second, divergent implementation.
 *
 * Pure extraction: no behavior change from the original Workflow A steps —
 * same Traccar user shape (administrator:false, attributes.isManager:true),
 * same numz_users creation, same company_admin role assignment, same
 * one-time temporary-password response shape.
 */
import { Role, UserRole } from '../models/index.js';
import { traccarServiceFetch } from './traccarServiceClient.js';
import { ensureCompanyTraccarGroup } from './companyProvisioningService.js';
import { createForTraccarUser } from '../modules/profile/profileRepository.js';

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function conflict(message) {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
}

function traccarUnavailable(message) {
  const err = new Error(message);
  err.statusCode = 502;
  return err;
}

/**
 * Validates the `admin` block of a create-organization request. Matches the
 * exact rules previously inlined in modules/platform/companiesService.js's
 * validateInput().
 */
export function validateAdminInput(admin) {
  const input = admin || {};
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim();
  const password = String(input.password || '');

  if (!name) throw badRequest('admin.name is required');
  if (!email || !email.includes('@')) throw badRequest('admin.email must be a valid email');
  if (password.length < 6) throw badRequest('admin.password must be at least 6 characters');

  return {
    name, email, phone: input.phone || null, password,
  };
}

/**
 * Provisions a real, login-capable first administrator for a company that
 * already exists: Traccar user (administrator:false, attributes.isManager:true
 * — tenant-scoped, never platform-wide) -> numz_users row -> company_admin
 * role assignment. Returns the one-time temporary password; nothing stores it
 * in plaintext beyond this single response.
 *
 * Ordering preserved from the original workflow: the Traccar user is created
 * FIRST (fail before writing anything to Postgres for this admin).
 */
export async function provisionCompanyAdmin({ companyId, admin }) {
  const adminInput = validateAdminInput(admin);

  let traccarUser;
  try {
    traccarUser = await traccarServiceFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        name: adminInput.name,
        email: adminInput.email,
        password: adminInput.password,
        administrator: false,
        attributes: { isManager: true },
      }),
    });
  } catch (err) {
    // Traccar validates uniqueness at the DB layer, not before — a duplicate
    // email surfaces as a raw, unhandled SQLIntegrityConstraintViolation
    // (a full Java stack trace as the response body), not a clean 400. Catch
    // that specific, common, actionable case and translate it; anything else
    // Traccar throws is logged in full server-side but never forwarded
    // verbatim to the client (it can be arbitrarily large and leaks internal
    // detail — stack traces, driver/class names, SQL).
    if (/duplicate entry/i.test(err.message) && /email/i.test(err.message)) {
      throw conflict(`An account with the email "${adminInput.email}" already exists — use a different email for this admin.`);
    }
    console.error('[provisionCompanyAdmin] Traccar user creation failed:', err);
    throw traccarUnavailable('Failed to create the administrator account in Traccar. Try again, or contact support if this persists.');
  }

  const numzUser = await createForTraccarUser({
    traccarUserId: traccarUser.id,
    email: adminInput.email,
    companyId,
  });

  const companyAdminRole = await Role.findOne({ where: { key: 'company_admin', companyId: null } });
  if (companyAdminRole) {
    await UserRole.findOrCreate({
      where: { numzUserId: numzUser.id, roleId: companyAdminRole.id, companyId },
    });
  }

  return {
    traccarUserId: traccarUser.id,
    name: adminInput.name,
    email: adminInput.email,
    // Returned once, here only — see docstring above.
    temporaryPassword: adminInput.password,
  };
}

/**
 * Thin wrapper so callers of this module don't need to also import
 * companyProvisioningService.js directly — keeps the "one place to create an
 * organization's Traccar group" concept co-located with the rest of
 * provisioning.
 */
export async function ensureTraccarGroupForCompany(companyId) {
  return ensureCompanyTraccarGroup(companyId);
}
