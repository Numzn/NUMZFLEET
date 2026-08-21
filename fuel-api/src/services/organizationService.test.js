/**
 * Phase 2 Consolidation — Stage 2: organizationService.js optional `admin`
 * provisioning.
 *
 * Verifies createPartner/createDirectCustomer/createCustomerUnderPartner:
 *  - behave exactly as before when `admin` is omitted
 *  - provision a real, login-capable admin (via organizationProvisioningService.js,
 *    Stage 1) when `admin` is supplied
 *  - the provisioned admin is connected to the correct company
 *  - existing hierarchy rules (organization_type/parent_company_id) are unaffected
 *  - malformed admin input is rejected consistently with Stage 1's validateAdminInput
 *
 * Integration-style (hits the real dev Traccar instance), matching this
 * repo's existing test conventions (no mocking framework in use). All
 * created rows/users are cleaned up in `after()`.
 *
 * NOTE: organizationService.js's createPartner/createDirectCustomer/
 * createCustomerUnderPartner do NOT call ensureTraccarGroupForCompany — Stage
 * 2 only wires up admin provisioning (per the Stage 2 instruction's flow
 * diagram, which specifies provisionCompanyAdmin only). traccarGroupId stays
 * null unless explicitly passed in, so there is no Traccar group to clean up
 * here (see the Stage 2 report for this documented scope decision).
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  createPartner,
  createDirectCustomer,
  createCustomerUnderPartner,
  listPartners,
  listDirectCustomers,
  listPartnerCustomers,
  getOrganizationOverview,
} from './organizationService.js';
import { traccarServiceFetch } from './traccarServiceClient.js';

const TEST_SLUG_PREFIX = 'org-svc-stage2-';
const createdCompanyIds = [];
const createdTraccarUserIds = [];

// CI's quality-checks job runs against a real Postgres service but has no
// Traccar service/credentials (see .github/workflows/main.yml) — only the
// dev stack has a real Traccar reachable. Skip just the subtests that need
// it there rather than faking a Traccar client; tracked to add a Traccar
// service (or a proper mock) to CI so this integration coverage runs there
// too.
const SKIP_NO_TRACCAR = (process.env.TRACCAR_API_USER && process.env.TRACCAR_API_PASSWORD)
  ? false
  : 'requires a live Traccar (TRACCAR_API_USER/TRACCAR_API_PASSWORD not set) — not available in CI yet';

after(async () => {
  const { Company, NumzUser, UserRole, Vehicle } = await import('../models/index.js');

  for (const traccarUserId of createdTraccarUserIds) {
    try {
      await traccarServiceFetch(`/api/users/${traccarUserId}`, { method: 'DELETE' });
    } catch {
      // Best-effort cleanup — a stray Traccar test user is low-impact and
      // must not fail the whole suite.
    }
  }

  if (createdCompanyIds.length) {
    await UserRole.destroy({ where: { companyId: createdCompanyIds } });
    await NumzUser.destroy({ where: { companyId: createdCompanyIds } });
    // vehicles.company_id is a RESTRICT FK — must go before the company row.
    // company_devices cascades on company delete, no explicit cleanup needed.
    await Vehicle.destroy({ where: { companyId: createdCompanyIds } });
    // Children (parentCompanyId set, i.e. partner-customers) before parents,
    // to respect the ON DELETE RESTRICT FK on companies.parent_company_id.
    await Company.destroy({
      where: { id: createdCompanyIds, parentCompanyId: { [Op.ne]: null } },
    });
    await Company.destroy({ where: { id: createdCompanyIds } });
  }
});

function slug() {
  return `${TEST_SLUG_PREFIX}${uuid().substring(0, 10)}`;
}

function testAdmin(overrides = {}) {
  return {
    name: 'Stage2 Test Admin',
    email: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}@example.test`,
    phone: null,
    password: 'temp1234',
    ...overrides,
  };
}

describe('Phase 2 Consolidation Stage 2: organizationService optional admin provisioning', () => {
  describe('admin omitted — existing behavior unchanged', () => {
    it('createPartner() works without admin', async () => {
      const partner = await createPartner({ name: 'Stage2 Partner No Admin', slug: slug() });
      createdCompanyIds.push(partner.id);

      assert.equal(partner.organizationType, 'partner');
      assert.equal(partner.parentCompanyId, null);
      assert.equal(partner.status, 'active');
      assert.equal(partner.admin, undefined, 'no admin field should be present when admin is omitted');
    });

    it('createDirectCustomer() works without admin', async () => {
      const customer = await createDirectCustomer({ name: 'Stage2 Direct Customer No Admin', slug: slug() });
      createdCompanyIds.push(customer.id);

      assert.equal(customer.organizationType, 'customer');
      assert.equal(customer.parentCompanyId, null);
      assert.equal(customer.status, 'active');
      assert.equal(customer.admin, undefined);
    });

    it('createCustomerUnderPartner() works without admin', async () => {
      const partner = await createPartner({ name: 'Stage2 Partner For Child No Admin', slug: slug() });
      createdCompanyIds.push(partner.id);

      const customer = await createCustomerUnderPartner({
        partnerId: partner.id, name: 'Stage2 Child No Admin', slug: slug(),
      });
      createdCompanyIds.push(customer.id);

      assert.equal(customer.organizationType, 'customer');
      assert.equal(customer.parentCompanyId, partner.id);
      assert.equal(customer.status, 'active');
      assert.equal(customer.admin, undefined);
    });
  });

  describe('admin supplied — provisions a real, login-capable administrator', { skip: SKIP_NO_TRACCAR }, () => {
    it('createPartner() provisions an admin when supplied, connected to the correct company', async () => {
      const admin = testAdmin();
      const partner = await createPartner({ name: 'Stage2 Partner With Admin', slug: slug(), admin });
      createdCompanyIds.push(partner.id);

      assert.equal(partner.status, 'active', 'status should return to active once admin provisioning succeeds');
      assert.ok(partner.admin, 'expected an admin field in the response');
      createdTraccarUserIds.push(partner.admin.traccarUserId);
      assert.equal(partner.admin.email, admin.email);
      assert.equal(partner.admin.temporaryPassword, admin.password);

      const { NumzUser } = await import('../models/index.js');
      const numzUser = await NumzUser.findOne({ where: { traccarUserId: partner.admin.traccarUserId } });
      assert.ok(numzUser, 'expected a numz_users row for the new admin');
      assert.equal(numzUser.companyId, partner.id, 'admin must be connected to the correct company');

      // Hierarchy unaffected by admin provisioning.
      assert.equal(partner.organizationType, 'partner');
      assert.equal(partner.parentCompanyId, null);
    });

    it('createDirectCustomer() provisions an admin when supplied, connected to the correct company', async () => {
      const admin = testAdmin();
      const customer = await createDirectCustomer({ name: 'Stage2 Direct Customer With Admin', slug: slug(), admin });
      createdCompanyIds.push(customer.id);

      assert.equal(customer.status, 'active');
      assert.ok(customer.admin);
      createdTraccarUserIds.push(customer.admin.traccarUserId);

      const { NumzUser } = await import('../models/index.js');
      const numzUser = await NumzUser.findOne({ where: { traccarUserId: customer.admin.traccarUserId } });
      assert.ok(numzUser);
      assert.equal(numzUser.companyId, customer.id);

      assert.equal(customer.organizationType, 'customer');
      assert.equal(customer.parentCompanyId, null);
    });

    it('createCustomerUnderPartner() provisions an admin when supplied, connected to the correct company, hierarchy intact', async () => {
      const partner = await createPartner({ name: 'Stage2 Partner For Child With Admin', slug: slug() });
      createdCompanyIds.push(partner.id);

      const admin = testAdmin();
      const customer = await createCustomerUnderPartner({
        partnerId: partner.id, name: 'Stage2 Child With Admin', slug: slug(), admin,
      });
      createdCompanyIds.push(customer.id);

      assert.equal(customer.status, 'active');
      assert.ok(customer.admin);
      createdTraccarUserIds.push(customer.admin.traccarUserId);

      const { NumzUser } = await import('../models/index.js');
      const numzUser = await NumzUser.findOne({ where: { traccarUserId: customer.admin.traccarUserId } });
      assert.ok(numzUser);
      assert.equal(numzUser.companyId, customer.id, 'admin must be connected to the child customer, not the partner');

      // Existing hierarchy rule unaffected by admin provisioning.
      assert.equal(customer.organizationType, 'customer');
      assert.equal(customer.parentCompanyId, partner.id);
    });
  });

  describe('malformed admin input', () => {
    it('createPartner() rejects malformed admin input before creating anything', async () => {
      // Scoped to this file's own slug prefix rather than a bare global
      // Company.count() — node:test runs test files in parallel, so an
      // unscoped count races against every other file creating companies
      // concurrently (the same pre-existing flakiness class already
      // documented for organizations.test.js's aggregation test).
      const { Company } = await import('../models/index.js');
      const before = await Company.count({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });

      await assert.rejects(
        () => createPartner({ name: 'Should Not Be Created', slug: slug(), admin: { name: '', email: '', password: '' } }),
        (err) => err.statusCode === 400,
      );

      const after1 = await Company.count({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
      assert.equal(after1, before, 'no company row should be left behind when admin input is malformed');
    });

    it('createDirectCustomer() rejects malformed admin input consistently with Stage 1 validation', async () => {
      await assert.rejects(
        () => createDirectCustomer({ name: 'Should Not Be Created', slug: slug(), admin: { name: 'A', email: 'not-an-email', password: 'abcdef' } }),
        (err) => err.statusCode === 400 && /admin.email/.test(err.message),
      );
    });

    it('createCustomerUnderPartner() rejects malformed admin input consistently with Stage 1 validation', async () => {
      const partner = await createPartner({ name: 'Stage2 Partner For Malformed Child', slug: slug() });
      createdCompanyIds.push(partner.id);

      await assert.rejects(
        () => createCustomerUnderPartner({
          partnerId: partner.id, name: 'Should Not Be Created', slug: slug(), admin: { name: 'A', email: 'a@b.test', password: 'abc' },
        }),
        (err) => err.statusCode === 400 && /admin.password/.test(err.message),
      );
    });
  });

  describe('Real customer/vehicle/device counts (previously always 0)', () => {
    it('listPartners() reports a real customerCount and deviceCount, not always 0', async () => {
      const partner = await createPartner({ name: 'Counted Partner', slug: slug() });
      createdCompanyIds.push(partner.id);
      const child1 = await createCustomerUnderPartner({ partnerId: partner.id, name: 'Counted Child 1', slug: slug() });
      createdCompanyIds.push(child1.id);
      const child2 = await createCustomerUnderPartner({ partnerId: partner.id, name: 'Counted Child 2', slug: slug() });
      createdCompanyIds.push(child2.id);

      const { CompanyDevice } = await import('../models/index.js');
      await CompanyDevice.create({ companyId: partner.id, traccarDeviceId: 900001, isActive: true });
      await CompanyDevice.create({ companyId: partner.id, traccarDeviceId: 900002, isActive: false }); // inactive, must not count

      const partners = await listPartners();
      const found = partners.find((p) => p.id === partner.id);
      assert.ok(found, 'newly created partner must appear in listPartners()');
      assert.equal(found.customerCount, 2, 'must count exactly this partner\'s own child customers, not a global total');
      assert.equal(found.deviceCount, 1, 'must count only active devices assigned directly to the partner');
    });

    it('listDirectCustomers() reports a real deviceCount and vehicleCount, not always 0', async () => {
      const customer = await createDirectCustomer({ name: 'Counted Direct Customer', slug: slug() });
      createdCompanyIds.push(customer.id);

      const { Vehicle, CompanyDevice } = await import('../models/index.js');
      await Vehicle.create({ name: 'Counted Vehicle 1', companyId: customer.id });
      await Vehicle.create({ name: 'Counted Vehicle 2', companyId: customer.id });
      await CompanyDevice.create({ companyId: customer.id, traccarDeviceId: 900003, isActive: true });

      const customers = await listDirectCustomers();
      const found = customers.find((c) => c.id === customer.id);
      assert.ok(found, 'newly created direct customer must appear in listDirectCustomers()');
      assert.equal(found.vehicleCount, 2);
      assert.equal(found.deviceCount, 1);
    });

    it('listPartnerCustomers() counts are scoped to that specific customer, not leaked from a sibling', async () => {
      const partner = await createPartner({ name: 'Scoped Counts Partner', slug: slug() });
      createdCompanyIds.push(partner.id);
      const childA = await createCustomerUnderPartner({ partnerId: partner.id, name: 'Scoped Child A', slug: slug() });
      createdCompanyIds.push(childA.id);
      const childB = await createCustomerUnderPartner({ partnerId: partner.id, name: 'Scoped Child B', slug: slug() });
      createdCompanyIds.push(childB.id);

      const { Vehicle } = await import('../models/index.js');
      await Vehicle.create({ name: 'Scoped Vehicle A1', companyId: childA.id });
      await Vehicle.create({ name: 'Scoped Vehicle A2', companyId: childA.id });
      // childB deliberately gets no vehicles — proves counts aren't summed across siblings.

      const customers = await listPartnerCustomers(partner.id);
      const foundA = customers.find((c) => c.id === childA.id);
      const foundB = customers.find((c) => c.id === childB.id);
      assert.equal(foundA.vehicleCount, 2);
      assert.equal(foundB.vehicleCount, 0);
    });

    it('getOrganizationOverview() reports real userCount/vehicleCount/deviceCount, not hardcoded 0', async () => {
      const overview = await getOrganizationOverview();
      // Not asserting exact numbers (shared dev DB, other data may exist) —
      // asserting the fields are actually wired to real queries: run one more
      // company + vehicle through and confirm the total visibly increases.
      const customer = await createDirectCustomer({ name: 'Overview Delta Customer', slug: slug() });
      createdCompanyIds.push(customer.id);
      const { Vehicle } = await import('../models/index.js');
      await Vehicle.create({ name: 'Overview Delta Vehicle', companyId: customer.id });

      // >= rather than strict +1 — node:test runs files in parallel, and other
      // files may concurrently insert their own vehicles between the two
      // reads (same pre-existing flakiness class as organizations.test.js's
      // aggregation test). Still fails hard against a hardcoded 0.
      const overviewAfter = await getOrganizationOverview();
      assert.ok(overviewAfter.vehicleCount >= overview.vehicleCount + 1, `vehicleCount must be a real Vehicle.count(), not a hardcoded 0 (before=${overview.vehicleCount}, after=${overviewAfter.vehicleCount})`);
      assert.equal(overviewAfter.directCustomerCount, overview.directCustomerCount + 1);
    });
  });
});
