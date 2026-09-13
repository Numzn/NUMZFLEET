/**
 * "A user joins a company" is not a standalone feature in NUMZFLEET today —
 * it happens as a side effect of the People/Access flow (a person's profile →
 * Access tab → EditRolesDialog) assigning that person a role for the first
 * time (see rolesRepository.ensureNumzUserForTraccarId,
 * which refuses to silently reattach a user already provisioned into a
 * different company). This verifies that moment also grants Traccar group
 * access immediately, rather than waiting for an unrelated device
 * assignment to happen to trigger it later.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { assignRoleToUser, removeRoleFromUser, listAssignments } from './rolesService.js';
import { traccarServiceFetch } from '../../services/traccarServiceClient.js';
import { requireManager } from '../../middleware/authGates.js';

const TEST_SLUG_PREFIX = 'rolesservice-';
const createdTraccarUserIds = [];

// CI's quality-checks job has no Traccar service/credentials — only the dev
// stack has a real Traccar reachable (see organizationProvisioningService.test.js
// for the established pattern this matches). Both cases here create a real
// Traccar user as fixture setup even though the second's own assertion is
// Postgres-only, so skip the whole suite together rather than picking apart
// which half of each case needs it.
const SKIP_NO_TRACCAR = (process.env.TRACCAR_API_USER && process.env.TRACCAR_API_PASSWORD)
  ? false
  : 'requires a live Traccar (TRACCAR_API_USER/TRACCAR_API_PASSWORD not set) — not available in CI yet';

after(async () => {
  const { Company, NumzUser } = await import('../../models/index.js');
  const companies = await Company.findAll({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  await NumzUser.destroy({ where: { email: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  for (const company of companies) {
    if (company.traccarGroupId) {
      await traccarServiceFetch(`/api/groups/${company.traccarGroupId}`, { method: 'DELETE' }).catch(() => {});
    }
  }
  for (const id of createdTraccarUserIds) {
    await traccarServiceFetch(`/api/users/${id}`, { method: 'DELETE' }).catch(() => {});
  }
});

async function makeCompany(name) {
  const { Company } = await import('../../models/index.js');
  return Company.create({
    id: uuid(),
    slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`,
    name,
    organizationType: 'customer',
    status: 'active',
  });
}

async function makeTraccarUser(label) {
  const email = `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}@test.local`;
  const user = await traccarServiceFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({
      name: label, email, password: 'TestPass123!', administrator: false,
    }),
  });
  createdTraccarUserIds.push(user.id);
  return user;
}

describe('assignRoleToUser — a user joining a company gets Traccar group access immediately', { skip: SKIP_NO_TRACCAR }, () => {
  it('reconciles the company\'s Traccar group as part of assigning a new team member\'s first role', async () => {
    const company = await makeCompany('Join Test Co');
    const tUser = await makeTraccarUser('Join Test User');

    const req = { auth: { companyId: company.id }, body: { traccarUserId: tUser.id, roleKey: 'driver' } };
    await assignRoleToUser(req);

    const { reconcileCompanyTraccarUsers } = await import('../../services/companyProvisioningService.js');
    const followUp = await reconcileCompanyTraccarUsers(company.id);
    assert.equal(followUp.granted, 0, 'assignRoleToUser must already have granted Traccar access — nothing left for a follow-up reconcile to do');
    assert.equal(followUp.revoked, 0);
  });

  it('rejects assigning a role to a user already provisioned into a different company (existing guard, unaffected)', async () => {
    const companyA = await makeCompany('Guard Co A');
    const companyB = await makeCompany('Guard Co B');
    const tUser = await makeTraccarUser('Guard User');

    await assignRoleToUser({ auth: { companyId: companyA.id }, body: { traccarUserId: tUser.id, roleKey: 'driver' } });

    await assert.rejects(
      () => assignRoleToUser({ auth: { companyId: companyB.id }, body: { traccarUserId: tUser.id, roleKey: 'driver' } }),
      (err) => err.statusCode === 409,
    );
  });
});

// ---------------------------------------------------------------------------
// Postgres-level correctness for the Person Access → EditRolesDialog wiring.
// No live Traccar required: nothing below exercises the Traccar group
// reconcile (that's the suite above) — these prove the RBAC read/write/guard
// behavior itself, so they run in CI too, unlike the Traccar-gated suite above.
// Fake Traccar ids are large, run-unique integers (same convention as
// tenantResolverService.test.js) — findRoleByKey/ensureNumzUserForTraccarId
// never verify the id against a real Traccar account, so none is needed here.
// ---------------------------------------------------------------------------

let nextFakeTraccarUserId = 800_000_000 + (Date.now() % 90_000_000);
const freshFakeTraccarUserId = () => nextFakeTraccarUserId++;
const createdNumzUserIds = [];

after(async () => {
  if (!createdNumzUserIds.length) return;
  const { NumzUser } = await import('../../models/index.js');
  await NumzUser.destroy({ where: { id: { [Op.in]: createdNumzUserIds } } });
});

/** Same shape seedRolesAndPermissions.js uses — findOrCreate so this suite never depends on that script having run against whatever DB it executes against (see tenantResolverService.test.js's identical rationale). */
async function ensureRole(key, label) {
  const { Role } = await import('../../models/index.js');
  const [role] = await Role.findOrCreate({
    where: { key, companyId: null },
    defaults: { label, isSystem: true },
  });
  return role;
}

async function trackNumzUserFor(traccarUserId) {
  const { NumzUser } = await import('../../models/index.js');
  const row = await NumzUser.findOne({ where: { traccarUserId } });
  if (row) createdNumzUserIds.push(row.id);
  return row;
}

describe('assignRoleToUser / removeRoleFromUser — Postgres-level correctness (no Traccar required)', () => {
  it('assigning a role creates a UserRole scoped to the caller\'s own company', async () => {
    const company = await makeCompany('PG Assign Co');
    await ensureRole('driver', 'Driver');
    const traccarUserId = freshFakeTraccarUserId();

    const result = await assignRoleToUser({ auth: { companyId: company.id }, body: { traccarUserId, roleKey: 'driver' } });
    const created = result.find((a) => a.traccarUserId === traccarUserId);
    assert.ok(created, 'assignment should appear in the returned company assignment list');
    assert.equal(created.roleKey, 'driver');

    const numzUser = await trackNumzUserFor(traccarUserId);
    assert.equal(numzUser.companyId, company.id, 'the auto-provisioned numz_users row must belong to the caller\'s own company');
  });

  it('listAssignments only returns the caller company\'s own assignments — never another company\'s', async () => {
    const companyA = await makeCompany('PG List Co A');
    const companyB = await makeCompany('PG List Co B');
    await ensureRole('driver', 'Driver');
    const idA = freshFakeTraccarUserId();
    const idB = freshFakeTraccarUserId();

    await assignRoleToUser({ auth: { companyId: companyA.id }, body: { traccarUserId: idA, roleKey: 'driver' } });
    await assignRoleToUser({ auth: { companyId: companyB.id }, body: { traccarUserId: idB, roleKey: 'driver' } });
    await trackNumzUserFor(idA);
    await trackNumzUserFor(idB);

    const listA = await listAssignments({ auth: { companyId: companyA.id } });
    assert.ok(listA.some((a) => a.traccarUserId === idA), 'company A must see its own assignment');
    assert.ok(!listA.some((a) => a.traccarUserId === idB), 'company A must never see company B\'s assignment');
  });

  it('removing an assignment removes exactly that one, scoped to the caller company', async () => {
    const company = await makeCompany('PG Remove Co');
    await ensureRole('technician', 'Technician');
    const traccarUserId = freshFakeTraccarUserId();

    const afterAssign = await assignRoleToUser({ auth: { companyId: company.id }, body: { traccarUserId, roleKey: 'technician' } });
    const target = afterAssign.find((a) => a.traccarUserId === traccarUserId);
    await trackNumzUserFor(traccarUserId);

    const afterRemove = await removeRoleFromUser({ auth: { companyId: company.id }, params: { userRoleId: target.userRoleId } });
    assert.ok(!afterRemove.some((a) => a.userRoleId === target.userRoleId), 'the removed assignment must be gone');
  });

  it('a company cannot remove another company\'s assignment (not found, not silently allowed)', async () => {
    const companyA = await makeCompany('PG CrossRemove Co A');
    const companyB = await makeCompany('PG CrossRemove Co B');
    await ensureRole('driver', 'Driver');
    const traccarUserId = freshFakeTraccarUserId();

    const assigned = await assignRoleToUser({ auth: { companyId: companyA.id }, body: { traccarUserId, roleKey: 'driver' } });
    const target = assigned.find((a) => a.traccarUserId === traccarUserId);
    await trackNumzUserFor(traccarUserId);

    await assert.rejects(
      () => removeRoleFromUser({ auth: { companyId: companyB.id }, params: { userRoleId: target.userRoleId } }),
      (err) => err.statusCode === 404,
    );
  });

  it('refuses to remove a company\'s last company_admin', async () => {
    const company = await makeCompany('PG LastAdmin Co');
    await ensureRole('company_admin', 'Company Admin');
    const traccarUserId = freshFakeTraccarUserId();

    const assigned = await assignRoleToUser({ auth: { companyId: company.id }, body: { traccarUserId, roleKey: 'company_admin' } });
    const target = assigned.find((a) => a.traccarUserId === traccarUserId && a.roleKey === 'company_admin');
    await trackNumzUserFor(traccarUserId);

    await assert.rejects(
      () => removeRoleFromUser({ auth: { companyId: company.id }, params: { userRoleId: target.userRoleId } }),
      (err) => err.statusCode === 409,
    );
  });
});

describe('requireManager — role assignment endpoints reject non-managers', () => {
  it('blocks a user who is neither Traccar isManager nor administrator', () => {
    const req = { user: { id: 1, isManager: false, administrator: false } };
    let statusCode = null;
    let body = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(payload) { body = payload; return this; },
    };
    let nextCalled = false;
    requireManager(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false, 'next() must not be called for a non-manager');
    assert.equal(statusCode, 403);
    assert.ok(body?.error);
  });

  it('allows a Traccar manager through', () => {
    const req = { user: { id: 2, isManager: true, administrator: false } };
    let nextCalled = false;
    requireManager(req, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
});
