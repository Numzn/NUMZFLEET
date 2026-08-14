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
} from './organizationService.js';
import { traccarServiceFetch } from './traccarServiceClient.js';

const TEST_SLUG_PREFIX = 'org-svc-stage2-';
const createdCompanyIds = [];
const createdTraccarUserIds = [];

after(async () => {
  const { Company, NumzUser, UserRole } = await import('../models/index.js');

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

  describe('admin supplied — provisions a real, login-capable administrator', () => {
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
      const before = await (async () => {
        const { Company } = await import('../models/index.js');
        return Company.count();
      })();

      await assert.rejects(
        () => createPartner({ name: 'Should Not Be Created', slug: slug(), admin: { name: '', email: '', password: '' } }),
        (err) => err.statusCode === 400,
      );

      const { Company } = await import('../models/index.js');
      const after1 = await Company.count();
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
});
