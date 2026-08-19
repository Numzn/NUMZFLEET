/**
 * Organization Service — Business logic for Partner & Customer management
 *
 * Rules:
 * - Partners: organization_type='partner', parentCompanyId=null
 * - Direct Customers: organization_type='customer', parentCompanyId=null
 * - Partner Customers: organization_type='customer', parentCompanyId=<partnerId>
 *
 * Phase 2 consolidation (Stage 2): createPartner/createDirectCustomer/
 * createCustomerUnderPartner accept an OPTIONAL `admin` field. When present,
 * a real login-capable administrator is provisioned via
 * organizationProvisioningService.js (Stage 1) — the same Traccar
 * user/numz_users/company_admin-role machinery used by the legacy
 * "Settings -> Platform -> Companies" workflow. When omitted, behavior is
 * byte-for-byte unchanged from before this stage.
 */

import { Company } from '../models/index.js';
import { Op } from 'sequelize';
import { validateAdminInput, provisionCompanyAdmin } from './organizationProvisioningService.js';

/**
 * Create a Partner
 */
export async function createPartner({
  name, slug, traccarGroupId, createdByUserId, admin,
}) {
  // Fail fast on malformed admin input BEFORE any write — mirrors the
  // "fail before writing anything" ordering already used by
  // organizationProvisioningService.js / the legacy Company Provisioning
  // workflow, so a malformed `admin` never leaves an orphaned company row.
  // (provisionCompanyAdmin re-validates internally too — cheap, harmless,
  // and keeps this check colocated with its single source of truth.)
  if (admin) {
    validateAdminInput(admin);
  }

  // Validate slug is unique
  const existing = await Company.findOne({ where: { slug } });
  if (existing) {
    const error = new Error('Slug already in use');
    error.statusCode = 400;
    throw error;
  }

  const partner = await Company.create({
    slug,
    name,
    traccarGroupId: traccarGroupId || null,
    organizationType: 'partner',
    parentCompanyId: null,
    status: admin ? 'provisioning' : 'active',
  });

  if (!admin) {
    return toOrgDto(partner);
  }

  // NOTE — documented limitation (matches the existing, pre-existing gap in
  // modules/platform/companiesService.js's provisionCompany(), not something
  // newly introduced here): there is no cross-system transaction spanning
  // Postgres and Traccar. If provisionCompanyAdmin fails here (e.g. Traccar
  // briefly unreachable) or the status update below fails, the partner is
  // left in 'provisioning' status — possibly with a real Traccar user/
  // numz_users row already created — and there is currently no automated
  // retry/repair path. This is an accepted MVP tradeoff, not silently
  // swallowed.
  const provisionedAdmin = await provisionCompanyAdmin({ companyId: partner.id, admin });
  await partner.update({ status: 'active' });

  return { ...toOrgDto(partner), admin: provisionedAdmin };
}

/**
 * Create a Direct Customer (no parent Partner)
 */
export async function createDirectCustomer({
  name, slug, traccarGroupId, createdByUserId, admin,
}) {
  if (admin) {
    validateAdminInput(admin);
  }

  // Validate slug is unique
  const existing = await Company.findOne({ where: { slug } });
  if (existing) {
    const error = new Error('Slug already in use');
    error.statusCode = 400;
    throw error;
  }

  const customer = await Company.create({
    slug,
    name,
    traccarGroupId: traccarGroupId || null,
    organizationType: 'customer',
    parentCompanyId: null,
    status: admin ? 'provisioning' : 'active',
  });

  if (!admin) {
    return toOrgDto(customer);
  }

  // See createPartner()'s NOTE above — same documented limitation applies.
  const provisionedAdmin = await provisionCompanyAdmin({ companyId: customer.id, admin });
  await customer.update({ status: 'active' });

  return { ...toOrgDto(customer), admin: provisionedAdmin };
}

/**
 * Create a Customer under a Partner
 */
export async function createCustomerUnderPartner({
  partnerId, name, slug, traccarGroupId, createdByUserId, admin,
}) {
  if (admin) {
    validateAdminInput(admin);
  }

  // Verify partner exists and is actually a partner
  const partner = await Company.findByPk(partnerId);
  if (!partner) {
    const error = new Error('Partner not found');
    error.statusCode = 404;
    throw error;
  }

  if (partner.organizationType !== 'partner') {
    const error = new Error('Parent must be a Partner organization');
    error.statusCode = 400;
    throw error;
  }

  // Validate slug is unique
  const existing = await Company.findOne({ where: { slug } });
  if (existing) {
    const error = new Error('Slug already in use');
    error.statusCode = 400;
    throw error;
  }

  const customer = await Company.create({
    slug,
    name,
    traccarGroupId: traccarGroupId || null,
    organizationType: 'customer',
    parentCompanyId: partnerId,
    status: admin ? 'provisioning' : 'active',
  });

  if (!admin) {
    return toOrgDto(customer);
  }

  // See createPartner()'s NOTE above — same documented limitation applies.
  const provisionedAdmin = await provisionCompanyAdmin({ companyId: customer.id, admin });
  await customer.update({ status: 'active' });

  return { ...toOrgDto(customer), admin: provisionedAdmin };
}

/**
 * List all Partners
 */
export async function listPartners() {
  const partners = await Company.findAll({
    where: { organizationType: 'partner' },
    order: [['name', 'ASC']],
  });

  return partners.map(toOrgDto);
}

/**
 * List all Direct Customers (parentCompanyId IS NULL)
 */
export async function listDirectCustomers() {
  const customers = await Company.findAll({
    where: {
      organizationType: 'customer',
      parentCompanyId: null,
    },
    order: [['name', 'ASC']],
  });

  return customers.map(toOrgDto);
}

/**
 * List Customers under a specific Partner
 */
export async function listPartnerCustomers(partnerCompanyId) {
  const customers = await Company.findAll({
    where: {
      organizationType: 'customer',
      parentCompanyId: partnerCompanyId,
    },
    order: [['name', 'ASC']],
  });

  return customers.map(toOrgDto);
}

/**
 * Get Platform-level aggregate statistics
 */
export async function getOrganizationOverview() {
  const [partnerCount, directCustomerCount, partnerCustomerCount, userCount, vehicleCount, deviceCount] = await Promise.all([
    Company.count({ where: { organizationType: 'partner' } }),
    Company.count({ where: { organizationType: 'customer', parentCompanyId: null } }),
    Company.count({ where: { organizationType: 'customer', parentCompanyId: { [Op.ne]: null } } }),
    // TODO: Count users when user model is available
    0,
    // TODO: Count vehicles when vehicle model is available
    0,
    // TODO: Count devices when device model is available
    0,
  ]);

  return {
    partnerCount,
    directCustomerCount,
    partnerCustomerCount,
    totalCustomerCount: directCustomerCount + partnerCustomerCount,
    userCount,
    vehicleCount,
    deviceCount,
  };
}

/**
 * Get a Partner's own aggregate statistics
 */
export async function getPartnerOverview(partnerCompanyId) {
  const customerCount = await Company.count({
    where: { organizationType: 'customer', parentCompanyId: partnerCompanyId },
  });

  return { customerCount };
}

/**
 * Convert Company model to DTO
 */
function toOrgDto(company) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    organizationType: company.organizationType,
    parentCompanyId: company.parentCompanyId || null,
    traccarGroupId: company.traccarGroupId || null,
    status: company.status,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
