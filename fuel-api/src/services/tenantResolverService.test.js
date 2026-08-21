/**
 * Tenant Resolver — Identity and Home Context
 *
 * Every authenticated session belongs to exactly one organization: the
 * identity's own home company (or platform, for a home-less platform-only
 * identity). There is no cross-company context switching — these tests
 * prove activeContext always equals the identity's home context, for every
 * identity shape, and that fleet-scoped queries (listVehiclesMerged) stay
 * correctly scoped to that one company with no way to reach another
 * company's data through this service. Replaces the earlier Phase 2D
 * active-context-switching test suite (switchActiveContext/
 * resetActiveContext/canEnterCompanyContext/administrativePath), removed
 * along with the switching mechanism itself — see the organization-model
 * cleanup design report.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  resolveCompanyContextForTraccarUser,
  clearCompanyContextCache,
} from '../services/tenantResolverService.js';

// Traccar user IDs are INTEGER in Traccar/MySQL; use large, run-unique fake IDs
// (seeded from Date.now()) so they never collide with real seeded users (id 1,
// etc.) OR with rows left behind by a previous run of this same test file.
let nextTraccarUserId = 900_000_000 + (Date.now() % 90_000_000);
const freshTraccarUserId = () => nextTraccarUserId++;

const TEST_SLUG_PREFIX = 'tenantresolver-';

const createdUserRoleIds = [];

after(async () => {
  // Clean up everything this test file created, regardless of pass/fail, so
  // repeated runs never collide and the dev DB isn't left with test debris.
  const { Company, NumzUser, UserRole } = await import('../models/index.js');
  if (createdUserRoleIds.length) {
    await UserRole.destroy({ where: { id: { [Op.in]: createdUserRoleIds } } });
  }
  await NumzUser.destroy({ where: { email: { [Op.like]: `${TEST_SLUG_PREFIX}%@test.local` } } });
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
});

async function makeCompany(overrides = {}) {
  const { Company } = await import('../models/index.js');
  return Company.create({
    id: uuid(),
    slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`,
    name: 'Tenant Resolver Test Co',
    organizationType: 'customer',
    parentCompanyId: null,
    status: 'active',
    ...overrides,
  });
}

async function makeNumzUser(traccarUserId, companyId) {
  const { NumzUser } = await import('../models/index.js');
  return NumzUser.create({
    id: uuid(),
    traccarUserId,
    companyId,
    email: `${TEST_SLUG_PREFIX}${traccarUserId}@test.local`,
    displayName: `Tenant Resolver User ${traccarUserId}`,
    status: 'active',
  });
}

/**
 * Grants the platform_super_admin role (companyId IS NULL) to a numz user —
 * the additive signal getHomeContext() ORs into isSuperAdmin. Idempotently
 * finds-or-creates the system role itself first, using the same shape as
 * seedRolesAndPermissions.js, so this test doesn't depend on that script
 * having been run against whatever DB the suite executes against (e.g. a CI
 * database built via a bare model sync rather than the full seed path).
 */
async function grantPlatformSuperAdminRole(numzUserId) {
  const { Role, UserRole } = await import('../models/index.js');
  const [role] = await Role.findOrCreate({
    where: { key: 'platform_super_admin', companyId: null },
    defaults: { label: 'Platform Super Admin', isSystem: true },
  });
  const [userRole] = await UserRole.findOrCreate({
    where: { numzUserId, roleId: role.id, companyId: null },
  });
  createdUserRoleIds.push(userRole.id);
  return userRole;
}

function platformTraccarUser(id) {
  return { id, administrator: true, isManager: false, attributes: {} };
}

function ordinaryTraccarUser(id) {
  return { id, administrator: false, isManager: false, attributes: {} };
}

describe('activeContext always equals the identity\'s home context', () => {
  it('a plain customer: activeContext is their own company, always', async () => {
    clearCompanyContextCache();
    const traccarUserId = freshTraccarUserId();
    const customer = await makeCompany({ name: 'Home Customer', organizationType: 'customer' });
    await makeNumzUser(traccarUserId, customer.id);
    const customerUser = ordinaryTraccarUser(traccarUserId);

    const ctx = await resolveCompanyContextForTraccarUser(customerUser);
    assert.equal(ctx.activeContext.type, 'customer');
    assert.equal(ctx.activeContext.companyId, customer.id);
    assert.equal(ctx.homeCompanyId, customer.id);
  });

  it('a plain partner: activeContext is their own company, always', async () => {
    clearCompanyContextCache();
    const traccarUserId = freshTraccarUserId();
    const partner = await makeCompany({ name: 'Home Partner', organizationType: 'partner' });
    await makeNumzUser(traccarUserId, partner.id);
    const partnerUser = ordinaryTraccarUser(traccarUserId);

    const ctx = await resolveCompanyContextForTraccarUser(partnerUser);
    assert.equal(ctx.activeContext.type, 'partner');
    assert.equal(ctx.activeContext.companyId, partner.id);
  });

  it('a dual-capability identity (home company AND platform authority): activeContext is their home company, never platform', async () => {
    clearCompanyContextCache();
    const traccarUserId = freshTraccarUserId();
    const company = await makeCompany({ name: 'Dual Home Co', organizationType: 'customer' });
    const numzUser = await makeNumzUser(traccarUserId, company.id);
    await grantPlatformSuperAdminRole(numzUser.id);
    const dualUser = platformTraccarUser(traccarUserId);

    const ctx = await resolveCompanyContextForTraccarUser(dualUser);
    assert.equal(ctx.isSuperAdmin, true, 'platform capability must still be true');
    assert.equal(ctx.homeCompanyId, company.id);
    // The crux of the new model: platform capability is a management
    // capability available through Settings, never a second context this
    // identity's session operates inside.
    assert.equal(ctx.activeContext.type, 'customer');
    assert.equal(ctx.activeContext.companyId, company.id);
  });

  it('a pure platform admin (no home company): activeContext is platform — the only case where it legitimately is', async () => {
    clearCompanyContextCache();
    const traccarUserId = freshTraccarUserId();
    const pureAdmin = platformTraccarUser(traccarUserId);

    const ctx = await resolveCompanyContextForTraccarUser(pureAdmin);
    assert.equal(ctx.isSuperAdmin, true);
    assert.equal(ctx.homeCompanyId, null);
    assert.equal(ctx.activeContext.type, 'platform');
    assert.equal(ctx.activeContext.companyId, null);
  });

  it('a company-scoped admin WITHOUT the platform_super_admin role stays company_admin only (unaffected by the platform-capability branch)', async () => {
    clearCompanyContextCache();
    const traccarUserId = freshTraccarUserId();
    const company = await makeCompany({ name: 'No Role Co', organizationType: 'customer' });
    await makeNumzUser(traccarUserId, company.id);
    const adminUser = platformTraccarUser(traccarUserId); // administrator: true, has a company

    const ctx = await resolveCompanyContextForTraccarUser(adminUser);
    assert.equal(ctx.isSuperAdmin, false, 'administrator + companyId, no role grant, must not become platform-capable');
    assert.equal(ctx.homeCompanyId, company.id);
    assert.ok(ctx.roles.includes('company_admin'));
    assert.equal(ctx.activeContext.type, 'customer');
    assert.equal(ctx.activeContext.companyId, company.id);
  });

  it('resolveCompanyContextForTraccarUser is deterministic across repeated calls — nothing persists between them to change the answer', async () => {
    clearCompanyContextCache();
    const traccarUserId = freshTraccarUserId();
    const partner = await makeCompany({ name: 'Deterministic Partner', organizationType: 'partner' });
    await makeNumzUser(traccarUserId, partner.id);
    const partnerUser = ordinaryTraccarUser(traccarUserId);

    const first = await resolveCompanyContextForTraccarUser(partnerUser);
    const second = await resolveCompanyContextForTraccarUser(partnerUser);
    assert.equal(first.activeContext.companyId, partner.id);
    assert.equal(second.activeContext.companyId, partner.id);
    assert.equal(first.activeContext.companyId, second.activeContext.companyId);
  });
});

describe('Fleet scope is connected to activeContext (unaffected by removing context switching)', () => {
  it("a customer's vehicle list is scoped to their own company only", async () => {
    clearCompanyContextCache();
    const { Vehicle } = await import('../models/index.js');
    const { listVehiclesMerged } = await import('../services/vehicleFleetService.js');

    const customerA = await makeCompany({ name: 'Fleet Customer A', organizationType: 'customer' });
    const customerB = await makeCompany({ name: 'Fleet Customer B', organizationType: 'customer' });
    const vehicleA = await Vehicle.create({ name: 'Vehicle A', companyId: customerA.id });
    const vehicleB = await Vehicle.create({ name: 'Vehicle B', companyId: customerB.id });

    const traccarUserId = freshTraccarUserId();
    await makeNumzUser(traccarUserId, customerA.id);
    const customerUser = ordinaryTraccarUser(traccarUserId);

    const ctx = await resolveCompanyContextForTraccarUser(customerUser);
    const auth = {
      companyId: ctx.companyId,
      activeContext: ctx.activeContext,
      accessibleCustomerIds: ctx.accessibleCustomerIds,
    };

    const rows = await listVehiclesMerged(auth);
    const names = rows.map((r) => r.name);

    assert.ok(names.includes('Vehicle A'));
    assert.ok(!names.includes('Vehicle B'), "another customer's vehicle must not leak in");

    await Vehicle.destroy({ where: { id: [vehicleA.id, vehicleB.id] } });
  });

  it("a partner's vehicle list includes their own customers' vehicles (data visibility for business management, not a fleet session in that customer)", async () => {
    clearCompanyContextCache();
    const { Vehicle } = await import('../models/index.js');
    const { listVehiclesMerged } = await import('../services/vehicleFleetService.js');

    const partnerA = await makeCompany({ name: 'Fleet Partner A', organizationType: 'partner' });
    const customerA1 = await makeCompany({
      name: 'Fleet Customer A1', organizationType: 'customer', parentCompanyId: partnerA.id,
    });
    const partnerB = await makeCompany({ name: 'Fleet Partner B', organizationType: 'partner' });
    const customerB1 = await makeCompany({
      name: 'Fleet Customer B1', organizationType: 'customer', parentCompanyId: partnerB.id,
    });

    const vehicleA1 = await Vehicle.create({ name: 'Vehicle A1', companyId: customerA1.id });
    const vehicleB1 = await Vehicle.create({ name: 'Vehicle B1', companyId: customerB1.id });

    const traccarUserId = freshTraccarUserId();
    await makeNumzUser(traccarUserId, partnerA.id);
    const partnerUser = ordinaryTraccarUser(traccarUserId);

    const ctx = await resolveCompanyContextForTraccarUser(partnerUser);
    const auth = {
      companyId: ctx.companyId,
      activeContext: ctx.activeContext,
      accessibleCustomerIds: ctx.accessibleCustomerIds,
    };

    const rows = await listVehiclesMerged(auth);
    const names = rows.map((r) => r.name);

    assert.ok(names.includes('Vehicle A1'), 'own customer\'s vehicle must be visible');
    assert.ok(!names.includes('Vehicle B1'), "another partner's customer's vehicle must not leak in");

    await Vehicle.destroy({ where: { id: [vehicleA1.id, vehicleB1.id] } });
  });

  it('a platform admin with a home company: vehicle list is scoped to their HOME company, not every company (platform authority does not silently widen the fleet session)', async () => {
    clearCompanyContextCache();
    const { Vehicle } = await import('../models/index.js');
    const { listVehiclesMerged } = await import('../services/vehicleFleetService.js');

    const home = await makeCompany({ name: 'Fleet Admin Home', organizationType: 'customer' });
    const other = await makeCompany({ name: 'Fleet Admin Other', organizationType: 'customer' });
    const numzUser = await makeNumzUser(freshTraccarUserId(), home.id);
    await grantPlatformSuperAdminRole(numzUser.id);
    const dualUser = platformTraccarUser(numzUser.traccarUserId);

    const vehicleHome = await Vehicle.create({ name: 'Vehicle Home', companyId: home.id });
    const vehicleOther = await Vehicle.create({ name: 'Vehicle Other', companyId: other.id });

    const ctx = await resolveCompanyContextForTraccarUser(dualUser);
    const auth = {
      companyId: ctx.companyId,
      activeContext: ctx.activeContext,
      accessibleCustomerIds: ctx.accessibleCustomerIds,
    };

    const rows = await listVehiclesMerged(auth);
    const names = rows.map((r) => r.name);

    assert.ok(names.includes('Vehicle Home'));
    assert.ok(
      !names.includes('Vehicle Other'),
      'a platform admin\'s own fleet session must stay scoped to their home company — platform-wide visibility belongs to the separate Platform Overview aggregate endpoints, not this session\'s fleet scope',
    );

    await Vehicle.destroy({ where: { id: [vehicleHome.id, vehicleOther.id] } });
  });
});
