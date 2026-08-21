/**
 * Phase 2 Consolidation — Stage 1: organizationProvisioningService.js tests
 *
 * Pure extraction from modules/platform/companiesService.js — verifies the
 * shared admin-provisioning helper behaves identically to the original inline
 * implementation: validates admin input, creates a real Traccar user
 * (administrator:false, attributes.isManager:true), creates the numz_users
 * row, assigns the company_admin role, and returns a one-time temporary
 * password. Integration-style (hits the real dev Traccar instance), matching
 * this repo's existing test conventions (no mocking framework in use) — all
 * created rows/users are cleaned up in `after()`.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';

import {
  validateAdminInput,
  provisionCompanyAdmin,
  ensureTraccarGroupForCompany,
} from '../services/organizationProvisioningService.js';
import { traccarServiceFetch } from '../services/traccarServiceClient.js';

const TEST_SLUG_PREFIX = 'org-provisioning-test-';
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
    await Company.destroy({ where: { id: createdCompanyIds } });
  }
});

async function makeTestCompany(overrides = {}) {
  const { Company } = await import('../models/index.js');
  const company = await Company.create({
    id: uuid(),
    slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`,
    name: 'Org Provisioning Test Co',
    organizationType: 'customer',
    parentCompanyId: null,
    status: 'provisioning',
    ...overrides,
  });
  createdCompanyIds.push(company.id);
  return company;
}

describe('Phase 2 Consolidation Stage 1: organizationProvisioningService', () => {
  describe('validateAdminInput', () => {
    it('accepts a valid admin block', () => {
      const result = validateAdminInput({
        name: 'Jane Admin', email: 'jane@example.test', phone: '123', password: 'sixchr+',
      });
      assert.equal(result.name, 'Jane Admin');
      assert.equal(result.email, 'jane@example.test');
      assert.equal(result.phone, '123');
      assert.equal(result.password, 'sixchr+');
    });

    it('rejects a missing name', () => {
      assert.throws(
        () => validateAdminInput({ email: 'a@b.test', password: 'abcdef' }),
        (err) => err.statusCode === 400 && /admin.name/.test(err.message),
      );
    });

    it('rejects an invalid email', () => {
      assert.throws(
        () => validateAdminInput({ name: 'A', email: 'not-an-email', password: 'abcdef' }),
        (err) => err.statusCode === 400 && /admin.email/.test(err.message),
      );
    });

    it('rejects a password under 6 characters', () => {
      assert.throws(
        () => validateAdminInput({ name: 'A', email: 'a@b.test', password: 'abc' }),
        (err) => err.statusCode === 400 && /admin.password/.test(err.message),
      );
    });
  });

  describe('ensureTraccarGroupForCompany', { skip: SKIP_NO_TRACCAR }, () => {
    it('assigns a Traccar group id to a company that has none', async () => {
      const company = await makeTestCompany({ traccarGroupId: null });
      assert.equal(company.traccarGroupId, null);

      await ensureTraccarGroupForCompany(company.id);

      const { Company } = await import('../models/index.js');
      const reloaded = await Company.findByPk(company.id);
      assert.ok(reloaded.traccarGroupId, 'expected a Traccar group id to be assigned');
    });
  });

  describe('provisionCompanyAdmin', () => {
    it('creates a real Traccar user, a numz_users row, and assigns company_admin — returns the temp password once', { skip: SKIP_NO_TRACCAR }, async () => {
      const company = await makeTestCompany();
      const email = `org-provisioning-test-${uuid().substring(0, 8)}@example.test`;

      const result = await provisionCompanyAdmin({
        companyId: company.id,
        admin: {
          name: 'Stage1 Test Admin', email, phone: null, password: 'temp1234',
        },
      });

      assert.ok(result.traccarUserId, 'expected a Traccar user id');
      createdTraccarUserIds.push(result.traccarUserId);
      assert.equal(result.name, 'Stage1 Test Admin');
      assert.equal(result.email, email);
      assert.equal(result.temporaryPassword, 'temp1234');

      const { NumzUser, UserRole, Role } = await import('../models/index.js');
      const numzUser = await NumzUser.findOne({ where: { traccarUserId: result.traccarUserId } });
      assert.ok(numzUser, 'expected a numz_users row for the new admin');
      assert.equal(numzUser.companyId, company.id);
      assert.equal(numzUser.email, email);

      const companyAdminRole = await Role.findOne({ where: { key: 'company_admin', companyId: null } });
      if (companyAdminRole) {
        const assignment = await UserRole.findOne({
          where: { numzUserId: numzUser.id, roleId: companyAdminRole.id, companyId: company.id },
        });
        assert.ok(assignment, 'expected a company_admin UserRole assignment');
      }
    });

    it('rejects invalid admin input before creating anything in Traccar', async () => {
      const company = await makeTestCompany();
      await assert.rejects(
        () => provisionCompanyAdmin({ companyId: company.id, admin: { name: '', email: '', password: '' } }),
        (err) => err.statusCode === 400,
      );
    });
  });
});
