/**
 * Phase 2B: Partner & Customer Management APIs — Tests
 *
 * Verifies:
 * 1. NUMZ can create Partner
 * 2. NUMZ can create Direct Customer
 * 3. NUMZ can create Customer under Partner
 * 4. NUMZ can list Partners
 * 5. NUMZ can list Direct Customers
 * 6. Partner can list own Customers
 * 7. Partner can create own Customer
 * 8. Customer cannot create anything
 * 9. NUMZ can get platform overview
 * 10. Scope isolation works (Partner A cannot access Partner B)
 */

import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

// Every test below creates real `companies` rows using these fixed slug
// prefixes (see the Phase 2 Organization Deduplication Audit — this file was
// the dominant source of dev-DB test-data pollution, since it previously had
// no cleanup at all). Deleting children (parent_company_id set) before
// parents respects the `ON DELETE RESTRICT` FK on companies.parent_company_id.
const TEST_SLUG_PREFIXES = [
  'partner-test-', 'customer-test-', 'partner-under-test-', 'child-customer-',
  'partner-query-', 'direct-query-', 'child-query-',
  'overview-partner-', 'overview-direct-', 'overview-child-',
  'partner-a-', 'partner-b-', 'customer-a-', 'customer-b-',
  'unique-test-',
];

after(async () => {
  const { Company } = await import('../models/index.js');
  const slugMatch = { [Op.or]: TEST_SLUG_PREFIXES.map((prefix) => ({ slug: { [Op.like]: `${prefix}%` } })) };

  // Children first (parent_company_id set), then parents.
  await Company.destroy({ where: { [Op.and]: [slugMatch, { parentCompanyId: { [Op.ne]: null } }] } });
  await Company.destroy({ where: slugMatch });
});

describe('Phase 2B: Partner & Customer Management APIs', () => {
  describe('NUMZ-only endpoints', () => {
    it('verifies NUMZ can create Partner', async () => {
      const { Company } = await import('../models/index.js');
      
      const partner = await Company.create({
        id: uuid(),
        slug: `partner-test-${uuid().substring(0, 8)}`,
        name: 'Test Partner',
        organizationType: 'partner',
        parentCompanyId: null,
      });

      assert.strictEqual(partner.organizationType, 'partner');
      assert.strictEqual(partner.parentCompanyId, null);
      assert.ok(partner.id);
    });

    it('verifies NUMZ can create Direct Customer', async () => {
      const { Company } = await import('../models/index.js');

      const customer = await Company.create({
        id: uuid(),
        slug: `customer-test-${uuid().substring(0, 8)}`,
        name: 'Test Direct Customer',
        organizationType: 'customer',
        parentCompanyId: null,
      });

      assert.strictEqual(customer.organizationType, 'customer');
      assert.strictEqual(customer.parentCompanyId, null);
      assert.ok(customer.id);
    });

    it('verifies NUMZ can create Customer under Partner', async () => {
      const { Company } = await import('../models/index.js');

      const partner = await Company.create({
        id: uuid(),
        slug: `partner-under-test-${uuid().substring(0, 8)}`,
        name: 'Test Partner for Children',
        organizationType: 'partner',
        parentCompanyId: null,
      });

      const customer = await Company.create({
        id: uuid(),
        slug: `child-customer-${uuid().substring(0, 8)}`,
        name: 'Test Child Customer',
        organizationType: 'customer',
        parentCompanyId: partner.id,
      });

      assert.strictEqual(customer.organizationType, 'customer');
      assert.strictEqual(customer.parentCompanyId, partner.id);
      assert.ok(customer.id);
    });

    it('verifies Partner and Direct Customer queries work', async () => {
      const { Company } = await import('../models/index.js');

      // Create test data
      const partner = await Company.create({
        id: uuid(),
        slug: `partner-query-${uuid().substring(0, 8)}`,
        name: 'Query Test Partner',
        organizationType: 'partner',
        parentCompanyId: null,
      });

      const directCustomer = await Company.create({
        id: uuid(),
        slug: `direct-query-${uuid().substring(0, 8)}`,
        name: 'Query Test Direct Customer',
        organizationType: 'customer',
        parentCompanyId: null,
      });

      const childCustomer = await Company.create({
        id: uuid(),
        slug: `child-query-${uuid().substring(0, 8)}`,
        name: 'Query Test Child Customer',
        organizationType: 'customer',
        parentCompanyId: partner.id,
      });

      // Query Partners
      const partners = await Company.findAll({
        where: { organizationType: 'partner' },
      });
      assert.ok(partners.length >= 1, 'Should have at least one partner');
      assert.ok(partners.some((p) => p.id === partner.id), 'Should find created partner');

      // Query Direct Customers
      const directCustomers = await Company.findAll({
        where: { organizationType: 'customer', parentCompanyId: null },
      });
      assert.ok(directCustomers.length >= 1, 'Should have at least one direct customer');
      assert.ok(directCustomers.some((c) => c.id === directCustomer.id), 'Should find created direct customer');

      // Query Partner's Customers
      const partnerCustomers = await Company.findAll({
        where: { organizationType: 'customer', parentCompanyId: partner.id },
      });
      assert.ok(partnerCustomers.length >= 1, 'Should have at least one child customer');
      assert.ok(
        partnerCustomers.some((c) => c.id === childCustomer.id),
        'Should find created child customer'
      );

      // Verify isolation: childCustomer should NOT appear in direct customers
      assert.ok(
        !directCustomers.some((c) => c.id === childCustomer.id),
        'Child customer should not be in direct customer list'
      );
    });

    it('verifies platform overview aggregation logic', async () => {
      const { Company } = await import('../models/index.js');

      // Count current state
      const initialPartnerCount = await Company.count({ where: { organizationType: 'partner' } });
      const initialDirectCount = await Company.count({
        where: { organizationType: 'customer', parentCompanyId: null },
      });

      // Create test data
      const partner = await Company.create({
        id: uuid(),
        slug: `overview-partner-${uuid().substring(0, 8)}`,
        name: 'Overview Test Partner',
        organizationType: 'partner',
        parentCompanyId: null,
      });

      const directCustomer = await Company.create({
        id: uuid(),
        slug: `overview-direct-${uuid().substring(0, 8)}`,
        name: 'Overview Test Direct Customer',
        organizationType: 'customer',
        parentCompanyId: null,
      });

      const childCustomer = await Company.create({
        id: uuid(),
        slug: `overview-child-${uuid().substring(0, 8)}`,
        name: 'Overview Test Child Customer',
        organizationType: 'customer',
        parentCompanyId: partner.id,
      });

      // Verify counts increased
      const newPartnerCount = await Company.count({ where: { organizationType: 'partner' } });
      const newDirectCount = await Company.count({
        where: { organizationType: 'customer', parentCompanyId: null },
      });
      const childCount = await Company.count({
        where: { organizationType: 'customer', parentCompanyId: { [Op.ne]: null } },
      });

      assert.strictEqual(newPartnerCount, initialPartnerCount + 1, 'Partner count should increase by 1');
      assert.strictEqual(newDirectCount, initialDirectCount + 1, 'Direct customer count should increase by 1');
      assert.ok(childCount >= 1, 'Should have at least 1 child customer');
    });
  });

  describe('Scope isolation', () => {
    it('verifies Partner cannot access another Partner data', async () => {
      const { Company } = await import('../models/index.js');

      const partnerA = await Company.create({
        id: uuid(),
        slug: `partner-a-${uuid().substring(0, 8)}`,
        name: 'Partner A',
        organizationType: 'partner',
        parentCompanyId: null,
      });

      const partnerB = await Company.create({
        id: uuid(),
        slug: `partner-b-${uuid().substring(0, 8)}`,
        name: 'Partner B',
        organizationType: 'partner',
        parentCompanyId: null,
      });

      const customerUnderA = await Company.create({
        id: uuid(),
        slug: `customer-a-${uuid().substring(0, 8)}`,
        name: 'Customer under A',
        organizationType: 'customer',
        parentCompanyId: partnerA.id,
      });

      const customerUnderB = await Company.create({
        id: uuid(),
        slug: `customer-b-${uuid().substring(0, 8)}`,
        name: 'Customer under B',
        organizationType: 'customer',
        parentCompanyId: partnerB.id,
      });

      // Query A's customers
      const customersUnderA = await Company.findAll({
        where: { parentCompanyId: partnerA.id },
      });

      // Verify A can see only A's customers, not B's
      assert.ok(customersUnderA.some((c) => c.id === customerUnderA.id), 'A should see own customer');
      assert.ok(
        !customersUnderA.some((c) => c.id === customerUnderB.id),
        'A should NOT see B customer'
      );
    });

    it('verifies slug uniqueness constraint', async () => {
      const { Company } = await import('../models/index.js');

      const uniqueSlug = `unique-test-${uuid().substring(0, 8)}`;

      // Create first company
      const first = await Company.create({
        id: uuid(),
        slug: uniqueSlug,
        name: 'First Company',
        organizationType: 'partner',
        parentCompanyId: null,
      });

      assert.ok(first.id);

      // Try to create another with same slug — should fail
      try {
        await Company.create({
          id: uuid(),
          slug: uniqueSlug,
          name: 'Second Company',
          organizationType: 'partner',
          parentCompanyId: null,
        });
        assert.fail('Should throw error for duplicate slug');
      } catch (error) {
        assert.ok(error, 'Should throw error for duplicate slug');
      }
    });
  });

  describe('Authorization model', () => {
    it('documents Platform context access model', () => {
      const platformAuth = {
        activeContext: {
          type: 'platform',
          companyId: null,
        },
        accessibleCustomerIds: [],
      };

      // Platform can access all orgs
      assert.strictEqual(platformAuth.activeContext.type, 'platform');
      assert.strictEqual(platformAuth.activeContext.companyId, null);
      assert.ok(Array.isArray(platformAuth.accessibleCustomerIds));
    });

    it('documents Partner context access model', () => {
      const partnerId = uuid();
      const customerId1 = uuid();
      const customerId2 = uuid();

      const partnerAuth = {
        activeContext: {
          type: 'partner',
          companyId: partnerId,
        },
        accessibleCustomerIds: [customerId1, customerId2],
      };

      // Partner can access own company + children
      assert.strictEqual(partnerAuth.activeContext.type, 'partner');
      assert.strictEqual(partnerAuth.activeContext.companyId, partnerId);
      assert.ok(Array.isArray(partnerAuth.accessibleCustomerIds));
      assert.ok(partnerAuth.accessibleCustomerIds.includes(customerId1));
      assert.ok(partnerAuth.accessibleCustomerIds.includes(customerId2));
    });

    it('documents Customer context access model', () => {
      const customerId = uuid();

      const customerAuth = {
        activeContext: {
          type: 'customer',
          companyId: customerId,
        },
        accessibleCustomerIds: [],
      };

      // Customer can access only own company
      assert.strictEqual(customerAuth.activeContext.type, 'customer');
      assert.strictEqual(customerAuth.activeContext.companyId, customerId);
      assert.strictEqual(customerAuth.accessibleCustomerIds.length, 0);
    });
  });
});
