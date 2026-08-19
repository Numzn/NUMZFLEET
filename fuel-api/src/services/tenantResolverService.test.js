/**
 * Phase 2D: Real Active-Context Switching — Tests
 *
 * Identity vs. Active Context: proves that switching context via
 * switchActiveContext() actually persists and is respected by a completely
 * separate subsequent call to resolveCompanyContextForTraccarUser() (i.e. a
 * fresh HTTP request), not merely that the switch endpoint itself returns
 * successfully.
 *
 * Security matrix (per Phase 2D spec):
 *   Platform  -> Platform / Partner A / Partner B / Customer A / Direct Customer   PASS
 *   Partner A -> Partner A / Customer A1 / Customer A2 (own)                       PASS
 *   Partner A -> Partner B / Customer of B / Platform                             DENY
 *   Customer A -> Customer A (self)                                               PASS
 *   Customer A -> Customer B / Partner / Platform                                 DENY
 *
 * Also proves the active context is wired into the existing fleet scoping
 * (listVehiclesMerged / getVehicleMerged), which is what makes this more than
 * a label change (see vehicleFleetService.js + scopeValidationService.js).
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  resolveCompanyContextForTraccarUser,
  switchActiveContext,
  resetActiveContext,
  canEnterCompanyContext,
  clearCompanyContextCache,
} from '../services/tenantResolverService.js';

// Traccar user IDs are INTEGER in Traccar/MySQL; use large, run-unique fake IDs
// (seeded from Date.now()) so they never collide with real seeded users (id 1,
// etc.) OR with rows left behind by a previous run of this same test file.
let nextTraccarUserId = 900_000_000 + (Date.now() % 90_000_000);
const freshTraccarUserId = () => nextTraccarUserId++;

const TEST_SLUG_PREFIX = 'phase2d-';

const createdUserRoleIds = [];

after(async () => {
  // Clean up everything this test file created, regardless of pass/fail, so
  // repeated runs never collide and the dev DB isn't left with test debris.
  const { Company, NumzUser, ActiveContext, UserRole } = await import('../models/index.js');
  if (createdUserRoleIds.length) {
    await UserRole.destroy({ where: { id: { [Op.in]: createdUserRoleIds } } });
  }
  await ActiveContext.destroy({ where: { traccarUserId: { [Op.gte]: 900_000_000 } } });
  await NumzUser.destroy({ where: { email: { [Op.like]: `${TEST_SLUG_PREFIX}%@test.local` } } });
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
});

async function makeCompany(overrides = {}) {
  const { Company } = await import('../models/index.js');
  return Company.create({
    id: uuid(),
    slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`,
    name: 'Phase 2D Test Co',
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
    displayName: `Phase 2D User ${traccarUserId}`,
    status: 'active',
  });
}

/**
 * Grants the already-seeded platform_super_admin role (companyId IS NULL) to
 * a numz user — the additive signal getHomeContext() ORs into isSuperAdmin.
 * Nothing in the application writes this today (Phase 5, deferred); tests
 * grant it directly, the same way an admin-only endpoint would later.
 */
async function grantPlatformSuperAdminRole(numzUserId) {
  const { Role, UserRole } = await import('../models/index.js');
  const role = await Role.findOne({ where: { key: 'platform_super_admin', companyId: null } });
  assert.ok(role, 'platform_super_admin role must already be seeded (seedRolesAndPermissions.js)');
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

describe('Phase 2D: Active-Context Switching', () => {
  describe('Security matrix', () => {
    it('Platform -> Platform: PASS', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const platformUser = platformTraccarUser(traccarUserId);

      const ctx = await switchActiveContext(platformUser, null);
      assert.equal(ctx.type, 'platform');
      assert.equal(ctx.companyId, null);
    });

    it('Platform -> Partner A: PASS, Platform -> Partner B: PASS', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const platformUser = platformTraccarUser(traccarUserId);

      const partnerA = await makeCompany({ name: 'Partner A', organizationType: 'partner' });
      const partnerB = await makeCompany({ name: 'Partner B', organizationType: 'partner' });

      const ctxA = await switchActiveContext(platformUser, partnerA.id);
      assert.equal(ctxA.type, 'partner');
      assert.equal(ctxA.companyId, partnerA.id);

      const ctxB = await switchActiveContext(platformUser, partnerB.id);
      assert.equal(ctxB.type, 'partner');
      assert.equal(ctxB.companyId, partnerB.id);
    });

    it('Platform -> Customer (direct and under a partner): PASS', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const platformUser = platformTraccarUser(traccarUserId);

      const partnerA = await makeCompany({ name: 'Partner A2', organizationType: 'partner' });
      const customerUnderPartner = await makeCompany({
        name: 'Customer under Partner A2', organizationType: 'customer', parentCompanyId: partnerA.id,
      });
      const directCustomer = await makeCompany({ name: 'Direct Customer', organizationType: 'customer' });

      const ctx1 = await switchActiveContext(platformUser, customerUnderPartner.id);
      assert.equal(ctx1.type, 'customer');
      assert.equal(ctx1.companyId, customerUnderPartner.id);

      const ctx2 = await switchActiveContext(platformUser, directCustomer.id);
      assert.equal(ctx2.type, 'customer');
      assert.equal(ctx2.companyId, directCustomer.id);
    });

    it('Partner A -> Partner A (own): PASS, Partner A -> Customer A1/A2 (own): PASS', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const partnerA = await makeCompany({ name: 'Partner A3', organizationType: 'partner' });
      const customerA1 = await makeCompany({
        name: 'Customer A1', organizationType: 'customer', parentCompanyId: partnerA.id,
      });
      const customerA2 = await makeCompany({
        name: 'Customer A2', organizationType: 'customer', parentCompanyId: partnerA.id,
      });
      await makeNumzUser(traccarUserId, partnerA.id);
      const partnerUser = ordinaryTraccarUser(traccarUserId);

      const ctxSelf = await switchActiveContext(partnerUser, partnerA.id);
      assert.equal(ctxSelf.type, 'partner');
      assert.equal(ctxSelf.companyId, partnerA.id);

      const ctxA1 = await switchActiveContext(partnerUser, customerA1.id);
      assert.equal(ctxA1.type, 'customer');
      assert.equal(ctxA1.companyId, customerA1.id);

      const ctxA2 = await switchActiveContext(partnerUser, customerA2.id);
      assert.equal(ctxA2.type, 'customer');
      assert.equal(ctxA2.companyId, customerA2.id);
    });

    it('Partner A -> Partner B: DENY, Partner A -> Customer of B: DENY, Partner A -> Platform: DENY', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const partnerA = await makeCompany({ name: 'Partner A4', organizationType: 'partner' });
      const partnerB = await makeCompany({ name: 'Partner B4', organizationType: 'partner' });
      const customerOfB = await makeCompany({
        name: 'Customer of B', organizationType: 'customer', parentCompanyId: partnerB.id,
      });
      await makeNumzUser(traccarUserId, partnerA.id);
      const partnerUser = ordinaryTraccarUser(traccarUserId);

      await assert.rejects(
        () => switchActiveContext(partnerUser, partnerB.id),
        (err) => err.statusCode === 403,
      );
      await assert.rejects(
        () => switchActiveContext(partnerUser, customerOfB.id),
        (err) => err.statusCode === 403,
      );
      await assert.rejects(
        () => switchActiveContext(partnerUser, null),
        (err) => err.statusCode === 403,
      );
    });

    it('Customer A -> Customer A (self): PASS', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const customerA = await makeCompany({ name: 'Customer A5', organizationType: 'customer' });
      await makeNumzUser(traccarUserId, customerA.id);
      const customerUser = ordinaryTraccarUser(traccarUserId);

      const ctx = await switchActiveContext(customerUser, customerA.id);
      assert.equal(ctx.type, 'customer');
      assert.equal(ctx.companyId, customerA.id);
    });

    it('Customer A -> Customer B: DENY, Customer A -> Partner: DENY, Customer A -> Platform: DENY', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const customerA = await makeCompany({ name: 'Customer A6', organizationType: 'customer' });
      const customerB = await makeCompany({ name: 'Customer B6', organizationType: 'customer' });
      const somePartner = await makeCompany({ name: 'Some Partner 6', organizationType: 'partner' });
      await makeNumzUser(traccarUserId, customerA.id);
      const customerUser = ordinaryTraccarUser(traccarUserId);

      await assert.rejects(
        () => switchActiveContext(customerUser, customerB.id),
        (err) => err.statusCode === 403,
      );
      await assert.rejects(
        () => switchActiveContext(customerUser, somePartner.id),
        (err) => err.statusCode === 403,
      );
      await assert.rejects(
        () => switchActiveContext(customerUser, null),
        (err) => err.statusCode === 403,
      );
    });

    it('switching to a nonexistent company: 404', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const platformUser = platformTraccarUser(traccarUserId);

      await assert.rejects(
        () => switchActiveContext(platformUser, uuid()),
        (err) => err.statusCode === 404,
      );
    });
  });

  describe('Context persists across a completely separate subsequent request', () => {
    it('after switching Platform -> Partner, a fresh resolveCompanyContextForTraccarUser call sees the partner context (not platform)', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const platformUser = platformTraccarUser(traccarUserId);
      const partner = await makeCompany({ name: 'Partner Persist', organizationType: 'partner' });

      await switchActiveContext(platformUser, partner.id);

      // Simulate a completely separate subsequent HTTP request: fresh call,
      // no shared in-memory state passed in — only the traccar user identity.
      const freshRequestCtx = await resolveCompanyContextForTraccarUser(platformUser);

      assert.equal(freshRequestCtx.activeContext.type, 'partner');
      assert.equal(freshRequestCtx.activeContext.companyId, partner.id);
      assert.equal(freshRequestCtx.companyId, partner.id);
      // Identity fact must be preserved — still the platform super admin.
      assert.equal(freshRequestCtx.isSuperAdmin, true);
    });

    it('context reset returns a platform admin to the platform context without a page reload', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const platformUser = platformTraccarUser(traccarUserId);
      const partner = await makeCompany({ name: 'Partner Reset', organizationType: 'partner' });

      await switchActiveContext(platformUser, partner.id);
      let ctx = await resolveCompanyContextForTraccarUser(platformUser);
      assert.equal(ctx.activeContext.type, 'partner');

      const resetResult = await resetActiveContext(platformUser);
      assert.equal(resetResult.type, 'platform');

      ctx = await resolveCompanyContextForTraccarUser(platformUser);
      assert.equal(ctx.activeContext.type, 'platform');
      assert.equal(ctx.activeContext.companyId, null);
    });

    it('a stale override (target company deleted) self-heals back to the home context', async () => {
      clearCompanyContextCache();
      const { Company } = await import('../models/index.js');
      const traccarUserId = freshTraccarUserId();
      const platformUser = platformTraccarUser(traccarUserId);
      const partner = await makeCompany({ name: 'Partner Stale', organizationType: 'partner' });

      await switchActiveContext(platformUser, partner.id);
      await Company.destroy({ where: { id: partner.id } });

      const ctx = await resolveCompanyContextForTraccarUser(platformUser);
      assert.equal(ctx.activeContext.type, 'platform');
    });
  });

  describe('canEnterCompanyContext (pure authorization function)', () => {
    it('platform identity can access any company', async () => {
      const target = await makeCompany({ name: 'Any Co', organizationType: 'customer' });
      assert.equal(canEnterCompanyContext({ isSuperAdmin: true, companyId: null }, target), true);
    });

    it('partner identity can access own company and its own customers only', async () => {
      const partnerA = await makeCompany({ name: 'Partner Pure A', organizationType: 'partner' });
      const ownCustomer = await makeCompany({
        name: 'Pure Own Customer', organizationType: 'customer', parentCompanyId: partnerA.id,
      });
      const otherPartner = await makeCompany({ name: 'Partner Pure B', organizationType: 'partner' });

      const partnerIdentity = {
        isSuperAdmin: false, companyId: partnerA.id, organizationType: 'partner',
      };

      assert.equal(canEnterCompanyContext(partnerIdentity, partnerA), true);
      assert.equal(canEnterCompanyContext(partnerIdentity, ownCustomer), true);
      assert.equal(canEnterCompanyContext(partnerIdentity, otherPartner), false);
    });

    it('customer identity can only access its own company', async () => {
      const customerA = await makeCompany({ name: 'Pure Customer A', organizationType: 'customer' });
      const customerB = await makeCompany({ name: 'Pure Customer B', organizationType: 'customer' });

      const customerIdentity = {
        isSuperAdmin: false, companyId: customerA.id, organizationType: 'customer',
      };

      assert.equal(canEnterCompanyContext(customerIdentity, customerA), true);
      assert.equal(canEnterCompanyContext(customerIdentity, customerB), false);
    });
  });

  describe('Fleet scope is actually connected to the active context (item 11)', () => {
    it('Platform -> Partner A context: vehicle list returns Customer A1 + A2 vehicles, not Customer B1', async () => {
      clearCompanyContextCache();
      const { Vehicle } = await import('../models/index.js');
      const { listVehiclesMerged } = await import('../services/vehicleFleetService.js');

      const partnerA = await makeCompany({ name: 'Fleet Partner A', organizationType: 'partner' });
      const customerA1 = await makeCompany({
        name: 'Fleet Customer A1', organizationType: 'customer', parentCompanyId: partnerA.id,
      });
      const customerA2 = await makeCompany({
        name: 'Fleet Customer A2', organizationType: 'customer', parentCompanyId: partnerA.id,
      });
      const partnerB = await makeCompany({ name: 'Fleet Partner B', organizationType: 'partner' });
      const customerB1 = await makeCompany({
        name: 'Fleet Customer B1', organizationType: 'customer', parentCompanyId: partnerB.id,
      });

      const vehicleA1 = await Vehicle.create({ name: 'Vehicle A1', companyId: customerA1.id });
      const vehicleA2 = await Vehicle.create({ name: 'Vehicle A2', companyId: customerA2.id });
      const vehicleB1 = await Vehicle.create({ name: 'Vehicle B1', companyId: customerB1.id });

      const traccarUserId = freshTraccarUserId();
      const platformUser = platformTraccarUser(traccarUserId);
      await switchActiveContext(platformUser, partnerA.id);

      const ctx = await resolveCompanyContextForTraccarUser(platformUser);
      const auth = {
        companyId: ctx.companyId,
        activeContext: ctx.activeContext,
        accessibleCustomerIds: ctx.accessibleCustomerIds,
      };

      const rows = await listVehiclesMerged(auth);
      const names = rows.map((r) => r.name);

      assert.ok(names.includes('Vehicle A1'), 'expected Vehicle A1 in Partner A scope');
      assert.ok(names.includes('Vehicle A2'), 'expected Vehicle A2 in Partner A scope');
      assert.ok(!names.includes('Vehicle B1'), 'Vehicle B1 (Partner B) must not leak into Partner A scope');

      // Cleanup this test's rows so it doesn't pollute later assertions/other tests.
      await Vehicle.destroy({ where: { id: [vehicleA1.id, vehicleA2.id, vehicleB1.id] } });
    });

    it('Partner A -> Customer A1 context: vehicle list returns only Vehicle A1', async () => {
      clearCompanyContextCache();
      const { Vehicle } = await import('../models/index.js');
      const { listVehiclesMerged } = await import('../services/vehicleFleetService.js');

      const partnerA = await makeCompany({ name: 'Fleet Partner A2', organizationType: 'partner' });
      const customerA1 = await makeCompany({
        name: 'Fleet Customer A1b', organizationType: 'customer', parentCompanyId: partnerA.id,
      });
      const customerA2 = await makeCompany({
        name: 'Fleet Customer A2b', organizationType: 'customer', parentCompanyId: partnerA.id,
      });

      const vehicleA1 = await Vehicle.create({ name: 'Vehicle A1b', companyId: customerA1.id });
      const vehicleA2 = await Vehicle.create({ name: 'Vehicle A2b', companyId: customerA2.id });

      const traccarUserId = freshTraccarUserId();
      await makeNumzUser(traccarUserId, partnerA.id);
      const partnerUser = ordinaryTraccarUser(traccarUserId);

      await switchActiveContext(partnerUser, customerA1.id);
      const ctx = await resolveCompanyContextForTraccarUser(partnerUser);
      const auth = {
        companyId: ctx.companyId,
        activeContext: ctx.activeContext,
        accessibleCustomerIds: ctx.accessibleCustomerIds,
      };

      const rows = await listVehiclesMerged(auth);
      const names = rows.map((r) => r.name);

      assert.ok(names.includes('Vehicle A1b'));
      assert.ok(!names.includes('Vehicle A2b'), 'Vehicle A2 must not appear once scoped down to Customer A1');

      await Vehicle.destroy({ where: { id: [vehicleA1.id, vehicleA2.id] } });
    });
  });

  describe('Mutation scope respects the active context (item 12)', () => {
    it('assertVehicleInTenant rejects a cross-partner vehicle mutation target', async () => {
      clearCompanyContextCache();
      const { Vehicle } = await import('../models/index.js');
      const { assertVehicleInTenant } = await import('../services/vehicleFleetService.js');

      const partnerA = await makeCompany({ name: 'Mut Partner A', organizationType: 'partner' });
      const customerA1 = await makeCompany({
        name: 'Mut Customer A1', organizationType: 'customer', parentCompanyId: partnerA.id,
      });
      const partnerB = await makeCompany({ name: 'Mut Partner B', organizationType: 'partner' });
      const customerB1 = await makeCompany({
        name: 'Mut Customer B1', organizationType: 'customer', parentCompanyId: partnerB.id,
      });

      const vehicleB1 = await Vehicle.create({ name: 'Mut Vehicle B1', companyId: customerB1.id });

      const traccarUserId = freshTraccarUserId();
      await makeNumzUser(traccarUserId, partnerA.id);
      const partnerUser = ordinaryTraccarUser(traccarUserId);
      await switchActiveContext(partnerUser, customerA1.id);
      const ctx = await resolveCompanyContextForTraccarUser(partnerUser);

      // Partner A (now scoped to Customer A1) must not be able to act on
      // Partner B's Customer B1 vehicle, even by ID.
      await assert.rejects(
        () => assertVehicleInTenant(vehicleB1.id, ctx.companyId),
        (err) => err.statusCode === 404,
      );

      await Vehicle.destroy({ where: { id: vehicleB1.id } });
    });
  });

  describe('Additive identity: platform capability + home company (Phase 1)', () => {
    it('a company-scoped admin WITHOUT the platform_super_admin role stays company_admin only (unchanged today behavior)', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const company = await makeCompany({ name: 'Additive Co No Role', organizationType: 'customer' });
      await makeNumzUser(traccarUserId, company.id);
      const adminUser = platformTraccarUser(traccarUserId); // administrator: true, has a company

      const ctx = await resolveCompanyContextForTraccarUser(adminUser);

      assert.equal(ctx.isSuperAdmin, false, 'administrator + companyId, no role grant, must not become platform-capable');
      assert.equal(ctx.homeCompanyId, company.id);
      assert.ok(ctx.roles.includes('company_admin'));
      assert.equal(ctx.activeContext.type, 'customer');
      assert.equal(ctx.activeContext.companyId, company.id);
    });

    it('a Traccar admin with BOTH a home company AND the platform_super_admin role becomes platform-capable while keeping their home company', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const company = await makeCompany({ name: 'Additive Co With Role', organizationType: 'customer' });
      const numzUser = await makeNumzUser(traccarUserId, company.id);
      await grantPlatformSuperAdminRole(numzUser.id);
      const dualUser = platformTraccarUser(traccarUserId);

      const ctx = await resolveCompanyContextForTraccarUser(dualUser);

      assert.equal(ctx.isSuperAdmin, true, 'the role grant must be sufficient even though numz_users.companyId is set');
      assert.equal(ctx.homeCompanyId, company.id, 'home company must survive alongside platform capability');
      assert.ok(ctx.roles.includes('super_admin'));
      assert.ok(ctx.roles.includes('company_admin'), 'operational roles for the home company must still apply');

      // Default (no override yet) must land on the HOME company, not platform —
      // this is the "log in and see my own fleet" behavior change.
      assert.equal(ctx.activeContext.type, 'customer');
      assert.equal(ctx.activeContext.companyId, company.id);

      assert.deepEqual(
        ctx.accessibleContexts.map((c) => c.type).sort(),
        ['customer', 'platform'],
        'a dual-capability identity must see both workspaces as accessible',
      );
    });

    it('the pure platform admin (no home company) is completely unaffected: isSuperAdmin true, homeCompanyId null, default is platform', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const pureAdmin = platformTraccarUser(traccarUserId); // no numz_users row at all

      const ctx = await resolveCompanyContextForTraccarUser(pureAdmin);

      assert.equal(ctx.isSuperAdmin, true);
      assert.equal(ctx.homeCompanyId, null);
      assert.equal(ctx.activeContext.type, 'platform');
      assert.equal(ctx.activeContext.companyId, null);
      assert.deepEqual(ctx.accessibleContexts.map((c) => c.type), ['platform']);
    });

    it('resetActiveContext returns a dual-capability identity to their HOME COMPANY, not platform', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const company = await makeCompany({ name: 'Additive Reset Co', organizationType: 'customer' });
      const numzUser = await makeNumzUser(traccarUserId, company.id);
      await grantPlatformSuperAdminRole(numzUser.id);
      const dualUser = platformTraccarUser(traccarUserId);

      // Explicitly switch into platform first, then reset — reset must land
      // back on the home company, per the new default (Phase 1 §3.4).
      await switchActiveContext(dualUser, null);
      let ctx = await resolveCompanyContextForTraccarUser(dualUser);
      assert.equal(ctx.activeContext.type, 'platform');

      const resetResult = await resetActiveContext(dualUser);
      assert.equal(resetResult.type, 'customer');
      assert.equal(resetResult.companyId, company.id);

      ctx = await resolveCompanyContextForTraccarUser(dualUser);
      assert.equal(ctx.activeContext.type, 'customer');
      assert.equal(ctx.activeContext.companyId, company.id);
    });

    it('resetActiveContext still returns a PURE platform admin to platform (no home company to fall back to)', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const pureAdmin = platformTraccarUser(traccarUserId);

      const resetResult = await resetActiveContext(pureAdmin);
      assert.equal(resetResult.type, 'platform');
      assert.equal(resetResult.companyId, null);
    });

    it('a dual-capability identity can still explicitly switch into platform, and it correctly overrides their home company (not silently staying on it)', async () => {
      clearCompanyContextCache();
      const traccarUserId = freshTraccarUserId();
      const company = await makeCompany({ name: 'Additive Override Co', organizationType: 'customer' });
      const numzUser = await makeNumzUser(traccarUserId, company.id);
      await grantPlatformSuperAdminRole(numzUser.id);
      const dualUser = platformTraccarUser(traccarUserId);

      const switchResult = await switchActiveContext(dualUser, null);
      assert.equal(switchResult.type, 'platform');
      assert.equal(switchResult.companyId, null);

      // A completely separate subsequent request must see platform too — not
      // silently fall back to the home company just because homeCtx.companyId
      // is non-null now (this is the applyActiveContextOverride fix).
      const ctx = await resolveCompanyContextForTraccarUser(dualUser);
      assert.equal(ctx.activeContext.type, 'platform');
      assert.equal(ctx.activeContext.companyId, null);
      assert.equal(ctx.isSuperAdmin, true, 'identity fact must still read true while viewing platform');
    });
  });
});
