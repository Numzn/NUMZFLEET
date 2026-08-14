/**
 * Phase 2A Authorization and Scope Tests
 * 
 * Verifies the three-tier access model:
 * - PLATFORM: Can access all companies
 * - PARTNER: Can access own company + child customers
 * - CUSTOMER: Can access own company only
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Op } from 'sequelize';
import {
  canAccessCompany,
  getAccessibleCompanyIds,
  validateCompanyScope,
  buildCompanyScopeWhere,
} from '../services/scopeValidationService.js';

describe('Phase 2A: Authorization and Scope Enforcement', () => {
  // Test fixtures
  const NUMZ_PLATFORM_AUTH = {
    activeContext: {
      type: 'platform',
      companyId: null,
      parentCompanyId: null,
    },
    organizationType: null,
    accessibleCustomerIds: [],
  };

  const PARTNER_POSH_AUTH = {
    activeContext: {
      type: 'partner',
      companyId: 'partner-posh-uuid',
      parentCompanyId: null,
    },
    organizationType: 'partner',
    accessibleCustomerIds: ['customer-abc-uuid', 'customer-xyz-uuid', 'customer-def-uuid'],
  };

  const PARTNER_B_AUTH = {
    activeContext: {
      type: 'partner',
      companyId: 'partner-b-uuid',
      parentCompanyId: null,
    },
    organizationType: 'partner',
    accessibleCustomerIds: ['customer-b1-uuid', 'customer-b2-uuid'],
  };

  const CUSTOMER_ABC_AUTH = {
    activeContext: {
      type: 'customer',
      companyId: 'customer-abc-uuid',
      parentCompanyId: 'partner-posh-uuid',
    },
    organizationType: 'customer',
    accessibleCustomerIds: [],
  };

  const CUSTOMER_DIRECT_AUTH = {
    activeContext: {
      type: 'customer',
      companyId: 'customer-direct-uuid',
      parentCompanyId: null,
    },
    organizationType: 'customer',
    accessibleCustomerIds: [],
  };

  describe('canAccessCompany', () => {
    describe('PLATFORM access', () => {
      it('platform can access any company', () => {
        assert.strictEqual(canAccessCompany(NUMZ_PLATFORM_AUTH, 'any-company-uuid'), true);
        assert.strictEqual(canAccessCompany(NUMZ_PLATFORM_AUTH, 'partner-posh-uuid'), true);
        assert.strictEqual(canAccessCompany(NUMZ_PLATFORM_AUTH, 'customer-abc-uuid'), true);
      });

      it('platform can access null company (platform-level)', () => {
        assert.strictEqual(canAccessCompany(NUMZ_PLATFORM_AUTH, null), true);
      });
    });

    describe('PARTNER access', () => {
      it('partner can access its own company', () => {
        assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'partner-posh-uuid'), true);
      });

      it('partner can access child customer companies', () => {
        assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'customer-abc-uuid'), true);
        assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'customer-xyz-uuid'), true);
        assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'customer-def-uuid'), true);
      });

      it('partner cannot access other partner companies', () => {
        assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'partner-b-uuid'), false);
      });

      it('partner cannot access other partner customers', () => {
        assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'customer-b1-uuid'), false);
        assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'customer-b2-uuid'), false);
      });

      it('partner cannot access direct customers', () => {
        assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'customer-direct-uuid'), false);
      });
    });

    describe('CUSTOMER access', () => {
      it('customer can access own company', () => {
        assert.strictEqual(canAccessCompany(CUSTOMER_ABC_AUTH, 'customer-abc-uuid'), true);
      });

      it('customer cannot access partner company', () => {
        assert.strictEqual(canAccessCompany(CUSTOMER_ABC_AUTH, 'partner-posh-uuid'), false);
      });

      it('customer cannot access sibling customer companies', () => {
        assert.strictEqual(canAccessCompany(CUSTOMER_ABC_AUTH, 'customer-xyz-uuid'), false);
        assert.strictEqual(canAccessCompany(CUSTOMER_ABC_AUTH, 'customer-def-uuid'), false);
      });

      it('direct customer cannot access other companies', () => {
        assert.strictEqual(canAccessCompany(CUSTOMER_DIRECT_AUTH, 'customer-abc-uuid'), false);
        assert.strictEqual(canAccessCompany(CUSTOMER_DIRECT_AUTH, 'partner-posh-uuid'), false);
      });
    });

    describe('Invalid contexts', () => {
      it('returns false for missing activeContext', () => {
        assert.strictEqual(canAccessCompany({}, 'any-company-uuid'), false);
        assert.strictEqual(canAccessCompany(null, 'any-company-uuid'), false);
      });

      it('returns false for missing auth', () => {
        assert.strictEqual(canAccessCompany(null, 'company-uuid'), false);
      });
    });
  });

  describe('getAccessibleCompanyIds', () => {
    describe('PLATFORM', () => {
      it('returns null (no filtering needed)', () => {
        assert.strictEqual(getAccessibleCompanyIds(NUMZ_PLATFORM_AUTH), null);
      });
    });

    describe('PARTNER', () => {
      it('returns own company + child customers', () => {
        const ids = getAccessibleCompanyIds(PARTNER_POSH_AUTH);
        assert.deepStrictEqual(
          ids.sort(),
          ['customer-abc-uuid', 'customer-def-uuid', 'customer-xyz-uuid', 'partner-posh-uuid'].sort()
        );
      });

      it('includes partner company even if no accessible customers', () => {
        const auth = {
          activeContext: {
            type: 'partner',
            companyId: 'partner-only-uuid',
          },
          accessibleCustomerIds: [],
        };
        const ids = getAccessibleCompanyIds(auth);
        assert.deepStrictEqual(ids, ['partner-only-uuid']);
      });
    });

    describe('CUSTOMER', () => {
      it('returns only own company', () => {
        const ids = getAccessibleCompanyIds(CUSTOMER_ABC_AUTH);
        assert.deepStrictEqual(ids, ['customer-abc-uuid']);
      });

      it('returns only own company for direct customer', () => {
        const ids = getAccessibleCompanyIds(CUSTOMER_DIRECT_AUTH);
        assert.deepStrictEqual(ids, ['customer-direct-uuid']);
      });
    });

    describe('Invalid contexts', () => {
      it('returns empty array for missing activeContext', () => {
        assert.deepStrictEqual(getAccessibleCompanyIds({}), []);
        assert.deepStrictEqual(getAccessibleCompanyIds(null), []);
      });
    });
  });

  describe('validateCompanyScope', () => {
    describe('Success cases', () => {
      it('platform can validate access to any company', () => {
        // Should not throw
        validateCompanyScope(NUMZ_PLATFORM_AUTH, 'any-company-uuid');
        validateCompanyScope(NUMZ_PLATFORM_AUTH, 'partner-posh-uuid');
        validateCompanyScope(NUMZ_PLATFORM_AUTH, 'customer-abc-uuid');
      });

      it('partner can validate access to own company', () => {
        validateCompanyScope(PARTNER_POSH_AUTH, 'partner-posh-uuid');
      });

      it('partner can validate access to child customer', () => {
        validateCompanyScope(PARTNER_POSH_AUTH, 'customer-abc-uuid');
      });

      it('customer can validate access to own company', () => {
        validateCompanyScope(CUSTOMER_ABC_AUTH, 'customer-abc-uuid');
      });
    });

    describe('Failure cases (throw 403)', () => {
      it('partner cannot access other partner', () => {
        assert.throws(
          () => validateCompanyScope(PARTNER_POSH_AUTH, 'partner-b-uuid'),
          (error) => error.statusCode === 403 && error.message.includes('denied')
        );
      });

      it('partner cannot access other partner customers', () => {
        assert.throws(
          () => validateCompanyScope(PARTNER_POSH_AUTH, 'customer-b1-uuid'),
          (error) => error.statusCode === 403
        );
      });

      it('customer cannot access partner', () => {
        assert.throws(
          () => validateCompanyScope(CUSTOMER_ABC_AUTH, 'partner-posh-uuid'),
          (error) => error.statusCode === 403
        );
      });

      it('customer cannot access sibling customer', () => {
        assert.throws(
          () => validateCompanyScope(CUSTOMER_ABC_AUTH, 'customer-xyz-uuid'),
          (error) => error.statusCode === 403
        );
      });

      it('direct customer cannot access partner companies', () => {
        assert.throws(
          () => validateCompanyScope(CUSTOMER_DIRECT_AUTH, 'any-company-uuid'),
          (error) => error.statusCode === 403
        );
      });
    });
  });

  describe('buildCompanyScopeWhere', () => {
    describe('PLATFORM scope', () => {
      it('returns null (no WHERE clause needed)', () => {
        const where = buildCompanyScopeWhere(NUMZ_PLATFORM_AUTH);
        assert.strictEqual(where, null);
      });

      it('returns null with custom field name', () => {
        const where = buildCompanyScopeWhere(NUMZ_PLATFORM_AUTH, 'owner_id');
        assert.strictEqual(where, null);
      });
    });

    describe('CUSTOMER scope', () => {
      it('returns single-company WHERE clause', () => {
        const where = buildCompanyScopeWhere(CUSTOMER_ABC_AUTH);
        assert.deepStrictEqual(where, { companyId: 'customer-abc-uuid' });
      });

      it('works with custom field name', () => {
        const where = buildCompanyScopeWhere(CUSTOMER_ABC_AUTH, 'owner_id');
        assert.deepStrictEqual(where, { owner_id: 'customer-abc-uuid' });
      });
    });

    describe('PARTNER scope', () => {
      it('returns Op.in WHERE clause for own + children', () => {
        const where = buildCompanyScopeWhere(PARTNER_POSH_AUTH);
        assert.ok(where.companyId);
        // Op.in uses Symbol internals, access directly with Op.in
        const companies = where.companyId[Op.in];
        assert.ok(Array.isArray(companies));
        assert.deepStrictEqual(
          companies.sort(),
          ['customer-abc-uuid', 'customer-def-uuid', 'customer-xyz-uuid', 'partner-posh-uuid'].sort()
        );
      });

      it('works with custom field name', () => {
        const where = buildCompanyScopeWhere(PARTNER_POSH_AUTH, 'tenant_id');
        assert.ok(where.tenant_id);
      });
    });
  });

  describe('Cross-tenant isolation', () => {
    it('Partner A cannot access Partner B customer even with ID guessing', () => {
      assert.strictEqual(canAccessCompany(PARTNER_POSH_AUTH, 'customer-b1-uuid'), false);
      assert.throws(
        () => validateCompanyScope(PARTNER_POSH_AUTH, 'customer-b1-uuid'),
        (error) => error.statusCode === 403
      );
    });

    it('Customer A cannot access Customer B even with ID guessing', () => {
      assert.strictEqual(canAccessCompany(CUSTOMER_ABC_AUTH, 'customer-xyz-uuid'), false);
      assert.throws(
        () => validateCompanyScope(CUSTOMER_ABC_AUTH, 'customer-xyz-uuid'),
        (error) => error.statusCode === 403
      );
    });

    it('Direct customer cannot access partner customer', () => {
      assert.strictEqual(canAccessCompany(CUSTOMER_DIRECT_AUTH, 'customer-abc-uuid'), false);
    });
  });

  describe('Edge cases', () => {
    it('handles partner with no child customers', () => {
      const auth = {
        activeContext: {
          type: 'partner',
          companyId: 'solo-partner-uuid',
        },
        accessibleCustomerIds: [],
      };
      const ids = getAccessibleCompanyIds(auth);
      assert.deepStrictEqual(ids, ['solo-partner-uuid']);
      assert.strictEqual(canAccessCompany(auth, 'solo-partner-uuid'), true);
      assert.strictEqual(canAccessCompany(auth, 'other-uuid'), false);
    });

    it('handles missing accessibleCustomerIds gracefully', () => {
      const auth = {
        activeContext: {
          type: 'partner',
          companyId: 'partner-uuid',
        },
        // No accessibleCustomerIds field
      };
      const ids = getAccessibleCompanyIds(auth);
      assert.deepStrictEqual(ids, ['partner-uuid']);
    });

    it('handles undefined companyId in activeContext', () => {
      const auth = {
        activeContext: {
          type: 'customer',
          companyId: undefined,
        },
      };
      const ids = getAccessibleCompanyIds(auth);
      assert.deepStrictEqual(ids, [undefined]);
    });
  });
});
