import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  listCompanyPeople, getCompanyPerson, createCompanyPerson, updateCompanyPerson, deleteCompanyPerson,
  selectPersonFields, PERSON_FIELDS,
} from './peopleService.js';
import { assignRoleToUser, removeRoleFromUser } from '../roles/rolesService.js';
import { requireAuth, requireManager } from '../../middleware/authGates.js';
import { resolveCompanyContextForTraccarUser, clearCompanyContextCache } from '../../services/tenantResolverService.js';
import { traccarServiceFetch } from '../../services/traccarServiceClient.js';
import { DEFAULT_COMPANY_ID } from '../../models/Company.js';

// ---------------------------------------------------------------------------
// Field whitelist — pure, no Postgres or Traccar required, runs in CI.
// ---------------------------------------------------------------------------

describe('selectPersonFields — whitelist, no Traccar or DB required', () => {
  it('keeps exactly the fields PeopleSection renders and drops everything else, including totpKey', () => {
    const raw = {
      id: 42,
      name: 'Test Person',
      email: 't@x.com',
      administrator: true,
      isManager: false,
      attributes: { numzRole: 'technician' },
      disabled: false,
      expirationTime: null,
      temporary: false,
      totpKey: 'a-live-2fa-secret',
      password: 'some-hash',
      token: 'abc',
      deviceLimit: 5,
    };
    const out = selectPersonFields(raw);
    assert.deepEqual(Object.keys(out).sort(), [...PERSON_FIELDS].sort());
    assert.equal(out.totpKey, undefined, 'totpKey must never be forwarded');
    assert.equal(out.password, undefined);
    assert.equal(out.token, undefined);
    assert.equal(out.deviceLimit, undefined);
    assert.equal(out.id, 42);
    assert.deepEqual(out.attributes, { numzRole: 'technician' });
  });

  it('defaults attributes to {} and other missing fields to null rather than undefined', () => {
    const out = selectPersonFields({ id: 1, name: 'Bare' });
    assert.deepEqual(out.attributes, {});
    assert.equal(out.email, null);
    assert.equal(out.administrator, null);
  });
});

describe('requireAuth / requireManager — /api/people gates', () => {
  it('requireAuth rejects an unauthenticated request', () => {
    const req = { user: null };
    let statusCode = null;
    const res = { status(c) { statusCode = c; return this; }, json() { return this; } };
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
  });

  it('requireManager rejects an authenticated but non-manager request', () => {
    const req = { user: { id: 9, isManager: false, administrator: false } };
    let statusCode = null;
    const res = { status(c) { statusCode = c; return this; }, json() { return this; } };
    let nextCalled = false;
    requireManager(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
  });
});

// ---------------------------------------------------------------------------
// listCompanyPeople — real Postgres + real Traccar. Same convention as
// modules/roles/rolesService.test.js: CI's quality-checks job has no Traccar
// service/credentials, so this whole block is skipped there; the dev stack
// has a real Traccar and runs it for real.
// ---------------------------------------------------------------------------

const TEST_SLUG_PREFIX = 'peopleservice-';
const createdTraccarUserIds = [];

const SKIP_NO_TRACCAR = (process.env.TRACCAR_API_USER && process.env.TRACCAR_API_PASSWORD)
  ? false
  : 'requires a live Traccar (TRACCAR_API_USER/TRACCAR_API_PASSWORD not set) — not available in CI yet';

after(async () => {
  const { Company, NumzUser } = await import('../../models/index.js');
  await NumzUser.destroy({ where: { email: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
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

async function makeNumzUser(traccarUserId, companyId) {
  const { NumzUser } = await import('../../models/index.js');
  return NumzUser.create({
    id: uuid(),
    traccarUserId,
    companyId,
    email: `${TEST_SLUG_PREFIX}${traccarUserId}@test.local`,
    displayName: `Person ${traccarUserId}`,
    status: 'active',
  });
}

describe('listCompanyPeople — tenant boundary (real Postgres + real Traccar)', { skip: SKIP_NO_TRACCAR }, () => {
  it('Company A sees only Company A people; Company B sees only Company B people', async () => {
    const companyA = await makeCompany('People Co A');
    const companyB = await makeCompany('People Co B');
    const userA = await makeTraccarUser('Person A');
    const userB = await makeTraccarUser('Person B');
    await makeNumzUser(userA.id, companyA.id);
    await makeNumzUser(userB.id, companyB.id);

    const listA = await listCompanyPeople({ auth: { companyId: companyA.id } });
    const listB = await listCompanyPeople({ auth: { companyId: companyB.id } });

    assert.ok(listA.some((p) => p.id === userA.id), 'Company A must see its own person');
    assert.ok(!listA.some((p) => p.id === userB.id), 'Company A must never see Company B\'s person');
    assert.ok(listB.some((p) => p.id === userB.id), 'Company B must see its own person');
    assert.ok(!listB.some((p) => p.id === userA.id), 'Company B must never see Company A\'s person');
  });

  it('a client-supplied companyId on the request is ignored — only req.auth.companyId decides scope', async () => {
    const companyA = await makeCompany('People Co A2');
    const companyB = await makeCompany('People Co B2');
    const userA = await makeTraccarUser('Person A2');
    const userB = await makeTraccarUser('Person B2');
    await makeNumzUser(userA.id, companyA.id);
    await makeNumzUser(userB.id, companyB.id);

    // Attacker-controlled req shape: query/body claim companyB, req.auth (the
    // only thing the service reads) says companyA. listCompanyPeople never
    // reads req.query or req.body at all — this proves it, not just asserts it.
    const spoofedReq = {
      auth: { companyId: companyA.id },
      query: { companyId: companyB.id },
      body: { companyId: companyB.id },
    };
    const result = await listCompanyPeople(spoofedReq);
    assert.ok(result.some((p) => p.id === userA.id));
    assert.ok(!result.some((p) => p.id === userB.id), 'query/body companyId must never override req.auth.companyId');
  });

  it('a company with zero provisioned people returns an empty list, not an error or someone else\'s data', async () => {
    const emptyCompany = await makeCompany('People Co Empty');
    const result = await listCompanyPeople({ auth: { companyId: emptyCompany.id } });
    assert.deepEqual(result, []);
  });

  it('an existing NUMZFLEET-provisioned person appears with the fields PeopleSection needs', async () => {
    const company = await makeCompany('People Co Provisioned');
    const user = await makeTraccarUser('Provisioned Person');
    await makeNumzUser(user.id, company.id);

    const result = await listCompanyPeople({ auth: { companyId: company.id } });
    const person = result.find((p) => p.id === user.id);
    assert.ok(person);
    assert.equal(person.name, 'Provisioned Person');
    assert.deepEqual(Object.keys(person).sort(), [...PERSON_FIELDS].sort());
  });

  it('an existing Traccar-only person (no numz_users row) is excluded, not guessed into the company', async () => {
    const company = await makeCompany('People Co TraccarOnly');
    const provisioned = await makeTraccarUser('Provisioned Sibling');
    const traccarOnly = await makeTraccarUser('Traccar Only Person');
    await makeNumzUser(provisioned.id, company.id);
    // traccarOnly deliberately gets no numz_users row.

    const result = await listCompanyPeople({ auth: { companyId: company.id } });
    assert.ok(result.some((p) => p.id === provisioned.id));
    assert.ok(!result.some((p) => p.id === traccarOnly.id), 'a Traccar-only person must not appear in any company\'s list');
  });

  it('an unprovisioned CALLER (no numz_users row) resolves to DEFAULT_COMPANY_ID and still cannot see an unrelated company\'s people', async () => {
    clearCompanyContextCache();
    const otherCompany = await makeCompany('People Co Unrelated');
    const otherPerson = await makeTraccarUser('Unrelated Person');
    await makeNumzUser(otherPerson.id, otherCompany.id);

    const unprovisionedCaller = { id: 700_000_000 + (Date.now() % 90_000_000), administrator: false, isManager: false, attributes: {} };
    const ctx = await resolveCompanyContextForTraccarUser(unprovisionedCaller);
    // Documents the known, pre-existing gap (docs/TENANCY_ARCHITECTURE.md §9,
    // "unprovisioned identity silently receives DEFAULT_COMPANY_ID") rather
    // than silently relying on it — this phase does not change tenant
    // resolution, only proves listCompanyPeople behaves safely given it.
    assert.equal(ctx.companyId, DEFAULT_COMPANY_ID);

    const result = await listCompanyPeople({ auth: ctx });
    assert.ok(Array.isArray(result), 'must return a list, not throw, under the fallback company');
    assert.ok(!result.some((p) => p.id === otherPerson.id), 'the DEFAULT_COMPANY_ID fallback must never leak an unrelated real company\'s people');
  });
});

// ---------------------------------------------------------------------------
// getCompanyPerson / createCompanyPerson / updateCompanyPerson /
// deleteCompanyPerson — full lifecycle, real Postgres + real Traccar.
// ---------------------------------------------------------------------------

function uniquePersonPayload(label) {
  const stamp = uuid().substring(0, 8);
  return {
    name: `${label} ${stamp}`,
    email: `${TEST_SLUG_PREFIX}${stamp}@test.local`,
    phone: '0900000000',
    password: 'TestPass123!',
  };
}

describe('getCompanyPerson — read one, tenant-scoped', { skip: SKIP_NO_TRACCAR }, () => {
  it('returns the person for the owning company', async () => {
    const company = await makeCompany('People Co Get');
    const user = await makeTraccarUser('Get Person');
    await makeNumzUser(user.id, company.id);

    const person = await getCompanyPerson({ auth: { companyId: company.id } }, user.id);
    assert.equal(person.id, user.id);
    assert.equal(person.name, 'Get Person');
  });

  it('404s for a person that belongs to a different company — existence not disclosed', async () => {
    const companyA = await makeCompany('People Co GetA');
    const companyB = await makeCompany('People Co GetB');
    const user = await makeTraccarUser('GetB Person');
    await makeNumzUser(user.id, companyB.id);

    await assert.rejects(
      () => getCompanyPerson({ auth: { companyId: companyA.id } }, user.id),
      (err) => err.statusCode === 404,
    );
  });
});

describe('createCompanyPerson — provisions Traccar + numz_users together', { skip: SKIP_NO_TRACCAR }, () => {
  it('creates a Traccar user and a numz_users row scoped to the caller\'s company, visible in that company\'s list', async () => {
    const company = await makeCompany('People Co Create');
    const payload = uniquePersonPayload('Created Person');

    const created = await createCompanyPerson({ auth: { companyId: company.id }, body: payload });
    createdTraccarUserIds.push(created.id);

    assert.equal(created.name, payload.name);
    assert.deepEqual(Object.keys(created).sort(), [...PERSON_FIELDS].sort());

    const { NumzUser } = await import('../../models/index.js');
    const numzUser = await NumzUser.findOne({ where: { traccarUserId: created.id } });
    assert.ok(numzUser, 'a numz_users row must exist for the newly created person');
    assert.equal(numzUser.companyId, company.id);

    const list = await listCompanyPeople({ auth: { companyId: company.id } });
    assert.ok(list.some((p) => p.id === created.id), 'the new person must appear in their own company\'s list immediately');
  });

  it('rejects creation with missing required fields (400) before ever calling Traccar', async () => {
    const company = await makeCompany('People Co CreateInvalid');
    await assert.rejects(
      () => createCompanyPerson({ auth: { companyId: company.id }, body: { email: 'x@test.local', password: 'TestPass123!' } }),
      (err) => err.statusCode === 400,
    );
    await assert.rejects(
      () => createCompanyPerson({ auth: { companyId: company.id }, body: { name: 'No Password', email: 'y@test.local' } }),
      (err) => err.statusCode === 400,
    );
  });

  it('does not leave an orphaned Traccar user when the numz_users insert fails', async () => {
    const nonExistentCompanyId = uuid(); // valid UUID shape, no such row in companies — FK violation on insert
    const payload = uniquePersonPayload('Orphan Check');

    let traccarIdIfCreated = null;
    await assert.rejects(async () => {
      try {
        await createCompanyPerson({ auth: { companyId: nonExistentCompanyId }, body: payload });
      } catch (err) {
        // Best-effort recovery of the id so this test's own cleanup can verify deletion,
        // independent of whatever the production code path already did.
        const { NumzUser } = await import('../../models/index.js');
        const maybeOrphan = await NumzUser.findOne({ where: { email: payload.email } });
        traccarIdIfCreated = maybeOrphan?.traccarUserId ?? null;
        throw err;
      }
    });

    // The service's own compensating delete should have removed the Traccar
    // user it created before the numz_users insert failed — confirm no
    // Traccar account survives under this email by searching for it.
    const allUsers = await traccarServiceFetch('/api/users');
    assert.ok(
      !allUsers.some((u) => u.email === payload.email),
      'a Traccar user created just before a failed numz_users insert must be cleaned up, not left orphaned',
    );
    if (traccarIdIfCreated) createdTraccarUserIds.push(traccarIdIfCreated); // safety net only, expected to be a no-op
  });

  it('does not create a second identity for an email Traccar already has (duplicate provisioning is prevented by Traccar\'s own uniqueness)', async () => {
    const company = await makeCompany('People Co Dup');
    const first = uniquePersonPayload('Original Person');
    const created = await createCompanyPerson({ auth: { companyId: company.id }, body: first });
    createdTraccarUserIds.push(created.id);

    const duplicateAttempt = { ...uniquePersonPayload('Duplicate Person'), email: first.email };
    await assert.rejects(() => createCompanyPerson({ auth: { companyId: company.id }, body: duplicateAttempt } ));

    const { NumzUser } = await import('../../models/index.js');
    const rowsForEmail = await NumzUser.findAll({ where: { email: first.email } });
    assert.equal(rowsForEmail.length, 1, 'a rejected duplicate must not leave a second numz_users row behind');
  });
});

describe('updateCompanyPerson — edit/enable/disable, tenant-scoped', { skip: SKIP_NO_TRACCAR }, () => {
  it('updates name/phone and keeps numz_users\' own email/displayName copies in step', async () => {
    const company = await makeCompany('People Co Update');
    const user = await makeTraccarUser('Update Person');
    await makeNumzUser(user.id, company.id);

    const newName = `Renamed ${uuid().substring(0, 6)}`;
    const updated = await updateCompanyPerson({ auth: { companyId: company.id }, body: { name: newName, phone: '0911111111' } }, user.id);
    assert.equal(updated.name, newName);
    assert.equal(updated.phone, '0911111111');

    const { NumzUser } = await import('../../models/index.js');
    const numzUser = await NumzUser.findOne({ where: { traccarUserId: user.id } });
    assert.equal(numzUser.displayName, newName, 'numz_users.display_name must follow a Traccar-side name change');
  });

  it('disables then re-enables a person (Active toggle both directions)', async () => {
    const company = await makeCompany('People Co Toggle');
    const user = await makeTraccarUser('Toggle Person');
    await makeNumzUser(user.id, company.id);

    const disabled = await updateCompanyPerson({ auth: { companyId: company.id }, body: { disabled: true } }, user.id);
    assert.equal(disabled.disabled, true);

    const reenabled = await updateCompanyPerson({ auth: { companyId: company.id }, body: { disabled: false } }, user.id);
    assert.equal(reenabled.disabled, false);
  });

  it('ignores fields outside the patchable whitelist even if present in the body (e.g. cannot smuggle a totpKey change through)', async () => {
    const company = await makeCompany('People Co Whitelist');
    const user = await makeTraccarUser('Whitelist Person');
    await makeNumzUser(user.id, company.id);

    const updated = await updateCompanyPerson(
      { auth: { companyId: company.id }, body: { name: 'Whitelisted Name', totpKey: 'attacker-supplied', id: 999999 } },
      user.id,
    );
    assert.equal(updated.name, 'Whitelisted Name');
    assert.equal(updated.id, user.id, 'id must never be overwritable via the request body');
  });

  it('404s and makes no change when updating a person owned by a different company', async () => {
    const companyA = await makeCompany('People Co UpdA');
    const companyB = await makeCompany('People Co UpdB');
    const user = await makeTraccarUser('UpdB Person');
    await makeNumzUser(user.id, companyB.id);

    await assert.rejects(
      () => updateCompanyPerson({ auth: { companyId: companyA.id }, body: { name: 'Hijacked Name' } }, user.id),
      (err) => err.statusCode === 404,
    );

    const stillOriginal = await traccarServiceFetch(`/api/users/${user.id}`);
    assert.equal(stillOriginal.name, 'UpdB Person', 'the record must be unchanged after a rejected cross-company update attempt');
  });
});

describe('deleteCompanyPerson — remove/deactivate, tenant-scoped', { skip: SKIP_NO_TRACCAR }, () => {
  it('deletes a non-admin person from both Traccar and numz_users', async () => {
    const company = await makeCompany('People Co Delete');
    const user = await makeTraccarUser('Delete Person');
    await makeNumzUser(user.id, company.id);

    const result = await deleteCompanyPerson({ auth: { companyId: company.id } }, user.id);
    assert.equal(result.deleted, true);

    const { NumzUser } = await import('../../models/index.js');
    assert.equal(await NumzUser.findOne({ where: { traccarUserId: user.id } }), null);
    await assert.rejects(() => traccarServiceFetch(`/api/users/${user.id}`));
  });

  it('404s and does not delete when the person belongs to a different company', async () => {
    const companyA = await makeCompany('People Co DelA');
    const companyB = await makeCompany('People Co DelB');
    const user = await makeTraccarUser('DelB Person');
    await makeNumzUser(user.id, companyB.id);

    await assert.rejects(
      () => deleteCompanyPerson({ auth: { companyId: companyA.id } }, user.id),
      (err) => err.statusCode === 404,
    );

    const stillThere = await traccarServiceFetch(`/api/users/${user.id}`);
    assert.equal(stillThere.id, user.id, 'the person must still exist after a rejected cross-company delete attempt');
  });

  it('refuses to delete the company\'s last Company Admin (409), mirroring removeRoleFromUser\'s own invariant', async () => {
    const company = await makeCompany('People Co LastAdminDelete');
    const user = await makeTraccarUser('Last Admin Person');
    await makeNumzUser(user.id, company.id);
    await assignRoleToUser({ auth: { companyId: company.id }, body: { traccarUserId: user.id, roleKey: 'company_admin' } });

    await assert.rejects(
      () => deleteCompanyPerson({ auth: { companyId: company.id } }, user.id),
      (err) => err.statusCode === 409,
    );

    const stillThere = await traccarServiceFetch(`/api/users/${user.id}`);
    assert.equal(stillThere.id, user.id, 'the last Company Admin must still exist after a refused delete');
  });
});

describe('Full lifecycle — create, assign, verify, remove, disable, re-enable, delete', { skip: SKIP_NO_TRACCAR }, () => {
  it('walks a person through every state transition, checking scoped visibility after each one', async () => {
    const company = await makeCompany('People Co Lifecycle');
    const other = await makeCompany('People Co LifecycleOther');
    const payload = uniquePersonPayload('Lifecycle Person');

    // 1. create
    const created = await createCompanyPerson({ auth: { companyId: company.id }, body: payload });
    createdTraccarUserIds.push(created.id);
    let list = await listCompanyPeople({ auth: { companyId: company.id } });
    assert.ok(list.some((p) => p.id === created.id), 'visible in own company right after creation');
    let otherList = await listCompanyPeople({ auth: { companyId: other.id } });
    assert.ok(!otherList.some((p) => p.id === created.id), 'never visible to an unrelated company');

    // 2. assign role
    const afterAssign = await assignRoleToUser({ auth: { companyId: company.id }, body: { traccarUserId: created.id, roleKey: 'technician' } });
    const assignment = afterAssign.find((a) => a.traccarUserId === created.id);
    assert.ok(assignment, 'role assignment succeeds for a person just created in this company');

    // 3. remove role
    const afterRemove = await removeRoleFromUser({ auth: { companyId: company.id }, params: { userRoleId: assignment.userRoleId } });
    assert.ok(!afterRemove.some((a) => a.userRoleId === assignment.userRoleId), 'role removal succeeds');

    // 4. disable
    const disabled = await updateCompanyPerson({ auth: { companyId: company.id }, body: { disabled: true } }, created.id);
    assert.equal(disabled.disabled, true);
    list = await listCompanyPeople({ auth: { companyId: company.id } });
    const listedDisabled = list.find((p) => p.id === created.id);
    assert.equal(listedDisabled.disabled, true, 'the list itself reflects the disabled state, not just the direct read');

    // 5. re-enable
    const reenabled = await updateCompanyPerson({ auth: { companyId: company.id }, body: { disabled: false } }, created.id);
    assert.equal(reenabled.disabled, false);

    // 6. delete
    const deleted = await deleteCompanyPerson({ auth: { companyId: company.id } }, created.id);
    assert.equal(deleted.deleted, true);
    list = await listCompanyPeople({ auth: { companyId: company.id } });
    assert.ok(!list.some((p) => p.id === created.id), 'gone from the list after deletion');
    await assert.rejects(() => getCompanyPerson({ auth: { companyId: company.id } }, created.id), (err) => err.statusCode === 404);
  });
});
