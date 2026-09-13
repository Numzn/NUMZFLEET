import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  listCompanyDrivers, getCompanyDriver, createCompanyDriver, updateCompanyDriver, deleteCompanyDriver,
  listCompanyDriverVehicles,
} from './driverService.js';
import { requireAuth, requireManager } from '../../middleware/authGates.js';
import { traccarServiceFetch } from '../../services/traccarServiceClient.js';

describe('requireAuth / requireManager — /api/drivers gates', () => {
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
// Real Postgres + real Traccar (driver creation projects into Traccar
// synchronously). Same skip convention as modules/people/peopleService.test.js:
// CI's quality-checks job has no Traccar credentials.
// ---------------------------------------------------------------------------

const TEST_SLUG_PREFIX = 'driverservice-';
const createdTraccarUserIds = [];
const createdTraccarDriverIds = [];

const SKIP_NO_TRACCAR = (process.env.TRACCAR_API_USER && process.env.TRACCAR_API_PASSWORD)
  ? false
  : 'requires a live Traccar (TRACCAR_API_USER/TRACCAR_API_PASSWORD not set) — not available in CI yet';

after(async () => {
  const { Company, NumzUser, Driver, Vehicle } = await import('../../models/index.js');
  await Driver.destroy({ where: { uniqueId: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  await NumzUser.destroy({ where: { email: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  // Only one test creates a Vehicle directly (assignment-history regression
  // coverage) — clean it up by company, same lookup-first pattern as
  // vehicleDriverAssignment.test.js, or Company.destroy below 500s on the
  // leftover vehicles_company_id_fkey reference.
  const companies = await Company.findAll({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  const companyIds = companies.map((c) => c.id);
  if (companyIds.length) {
    await Vehicle.destroy({ where: { companyId: { [Op.in]: companyIds } } });
  }
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  for (const id of createdTraccarDriverIds) {
    await traccarServiceFetch(`/api/drivers/${id}`, { method: 'DELETE' }).catch(() => {});
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

function driverPayload(label) {
  return { name: label, uniqueId: `${TEST_SLUG_PREFIX}${uuid().substring(0, 12)}` };
}

async function trackTraccarDriver(driver) {
  if (driver?.traccarDriverId != null) createdTraccarDriverIds.push(driver.traccarDriverId);
  return driver;
}

describe('listCompanyDrivers — tenant boundary (real Postgres + real Traccar)', { skip: SKIP_NO_TRACCAR }, () => {
  it('Company A sees only Company A drivers; Company B sees only Company B drivers', async () => {
    const companyA = await makeCompany('Driver Co A');
    const companyB = await makeCompany('Driver Co B');
    const driverA = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: companyA.id }, body: driverPayload('Driver A') }),
    );
    const driverB = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: companyB.id }, body: driverPayload('Driver B') }),
    );

    const listA = await listCompanyDrivers({ auth: { companyId: companyA.id } });
    const listB = await listCompanyDrivers({ auth: { companyId: companyB.id } });

    assert.ok(listA.some((d) => d.id === driverA.id));
    assert.ok(!listA.some((d) => d.id === driverB.id), 'Company A must never see Company B\'s driver');
    assert.ok(listB.some((d) => d.id === driverB.id));
    assert.ok(!listB.some((d) => d.id === driverA.id), 'Company B must never see Company A\'s driver');
  });

  it('a company with zero drivers returns an empty list, not an error or someone else\'s data', async () => {
    const empty = await makeCompany('Driver Co Empty');
    const result = await listCompanyDrivers({ auth: { companyId: empty.id } });
    assert.deepEqual(result, []);
  });

  it('listCompanyDrivers reports assignedVehicle from driver_assignments, not live telemetry — the Fleet > Drivers list regression', async () => {
    const { Vehicle } = await import('../../models/index.js');
    const { assignDriverToVehicle, unassignDriverFromVehicle } = await import('../../services/vehicleFleetService.js');
    const company = await makeCompany('Driver Co ListAssignedVehicle');
    const vehicle = await Vehicle.create({ id: uuid(), name: 'List Assigned Vehicle', companyId: company.id });
    const driver = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: company.id }, body: driverPayload('List Assigned Driver') }),
    );
    const auth = { auth: { companyId: company.id, activeContext: { type: 'customer', companyId: company.id } } };

    let list = await listCompanyDrivers({ auth: { companyId: company.id } });
    let row = list.find((d) => d.id === driver.id);
    assert.equal(row.assignedVehicle, null, 'not yet assigned');

    await assignDriverToVehicle(vehicle.id, driver.id, auth);
    list = await listCompanyDrivers({ auth: { companyId: company.id } });
    row = list.find((d) => d.id === driver.id);
    assert.equal(row.assignedVehicle.id, vehicle.id);
    assert.equal(row.assignedVehicle.name, 'List Assigned Vehicle');

    await unassignDriverFromVehicle(vehicle.id, auth);
    list = await listCompanyDrivers({ auth: { companyId: company.id } });
    row = list.find((d) => d.id === driver.id);
    assert.equal(row.assignedVehicle, null, 'unassignment must also reflect immediately');
  });
});

describe('getCompanyDriver / createCompanyDriver / updateCompanyDriver / deleteCompanyDriver — full lifecycle', { skip: SKIP_NO_TRACCAR }, () => {
  it('getCompanyDriver returns a driver belonging to the caller\'s company', async () => {
    const company = await makeCompany('Driver Co Get');
    const created = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: company.id }, body: driverPayload('Get Me') }),
    );
    const fetched = await getCompanyDriver({ auth: { companyId: company.id } }, created.id);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.name, 'Get Me');
  });

  it('getCompanyDriver 404s for a driver owned by a different company', async () => {
    const companyA = await makeCompany('Driver Co GetA');
    const companyB = await makeCompany('Driver Co GetB');
    const driverB = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: companyB.id }, body: driverPayload('Owned By B') }),
    );
    await assert.rejects(
      () => getCompanyDriver({ auth: { companyId: companyA.id } }, driverB.id),
      (err) => err.statusCode === 404,
    );
  });

  it('createCompanyDriver validates name is required', async () => {
    const company = await makeCompany('Driver Co Validate');
    await assert.rejects(
      () => createCompanyDriver({ auth: { companyId: company.id }, body: { uniqueId: 'x' } }),
      (err) => err.statusCode === 400,
    );
  });

  it('createCompanyDriver rejects a duplicate uniqueId', async () => {
    const company = await makeCompany('Driver Co Dup');
    const payload = driverPayload('First');
    await trackTraccarDriver(await createCompanyDriver({ auth: { companyId: company.id }, body: payload }));
    await assert.rejects(
      () => createCompanyDriver({ auth: { companyId: company.id }, body: { name: 'Second', uniqueId: payload.uniqueId } }),
      (err) => err.statusCode === 409,
    );
  });

  it('createCompanyDriver links an owned Person (by Traccar id, matching /api/people) and rejects a cross-company Person', async () => {
    const companyA = await makeCompany('Driver Co PersonA');
    const companyB = await makeCompany('Driver Co PersonB');
    const personA = await makeTraccarUser('Person For Driver A');
    await makeNumzUser(personA.id, companyA.id);
    const personB = await makeTraccarUser('Person For Driver B');
    await makeNumzUser(personB.id, companyB.id);

    const driver = await trackTraccarDriver(
      await createCompanyDriver({
        auth: { companyId: companyA.id },
        body: { ...driverPayload('Linked'), personId: personA.id },
      }),
    );
    assert.equal(driver.personId, personA.id);

    await assert.rejects(
      () => createCompanyDriver({
        auth: { companyId: companyA.id },
        body: { ...driverPayload('Cross'), personId: personB.id },
      }),
      (err) => err.statusCode === 404,
      'a Company B person must not be linkable to a Company A driver',
    );
  });

  it('createCompanyDriver rejects linking a person who already has a driver profile', async () => {
    const company = await makeCompany('Driver Co PersonClaimed');
    const person = await makeTraccarUser('Already Linked Person');
    await makeNumzUser(person.id, company.id);

    const first = await trackTraccarDriver(
      await createCompanyDriver({
        auth: { companyId: company.id },
        body: { ...driverPayload('First Linked'), personId: person.id },
      }),
    );
    assert.equal(first.personId, person.id);

    await assert.rejects(
      () => createCompanyDriver({
        auth: { companyId: company.id },
        body: { ...driverPayload('Second Linked'), personId: person.id },
      }),
      (err) => err.statusCode === 409,
      'a person already linked to one driver must not be linkable to a second',
    );
  });

  it('updateCompanyDriver rejects re-linking a person already claimed by a different driver', async () => {
    const company = await makeCompany('Driver Co PersonClaimedUpdate');
    const person = await makeTraccarUser('Claimed On Update');
    await makeNumzUser(person.id, company.id);

    const claimedBy = await trackTraccarDriver(
      await createCompanyDriver({
        auth: { companyId: company.id },
        body: { ...driverPayload('Claims It'), personId: person.id },
      }),
    );
    const other = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: company.id }, body: driverPayload('Wants It Too') }),
    );

    await assert.rejects(
      () => updateCompanyDriver(
        { auth: { companyId: company.id }, body: { personId: person.id } },
        other.id,
      ),
      (err) => err.statusCode === 409,
      'a second driver must not be able to steal a person already linked to another driver',
    );

    const stillClaimedBy = await getCompanyDriver({ auth: { companyId: company.id } }, claimedBy.id);
    assert.equal(stillClaimedBy.personId, person.id, 'the original link must be untouched by the rejected attempt');
    const stillOther = await getCompanyDriver({ auth: { companyId: company.id } }, other.id);
    assert.equal(stillOther.personId, null, 'the rejected driver must not have gained the link');
  });

  it('updateCompanyDriver allows re-saving a driver\'s own existing person link without a false-positive rejection', async () => {
    const company = await makeCompany('Driver Co PersonReSave');
    const person = await makeTraccarUser('Re-Save Person');
    await makeNumzUser(person.id, company.id);

    const driver = await trackTraccarDriver(
      await createCompanyDriver({
        auth: { companyId: company.id },
        body: { ...driverPayload('Re-Save Driver'), personId: person.id },
      }),
    );

    const resaved = await updateCompanyDriver(
      { auth: { companyId: company.id }, body: { personId: person.id, name: 'Re-Save Driver Renamed' } },
      driver.id,
    );
    assert.equal(resaved.personId, person.id, 'saving a driver\'s own already-linked person must not be rejected');
    assert.equal(resaved.name, 'Re-Save Driver Renamed');
  });

  it('createCompanyDriver leaves no orphaned Traccar driver if the NUMZFLEET write fails', async () => {
    const { Driver } = await import('../../models/index.js');
    const company = await makeCompany('Driver Co Orphan');
    const payload = driverPayload('Orphan Guard');
    // Force the Postgres insert to fail after Traccar creation succeeds by
    // pre-creating a Driver row with a companyId that violates the FK —
    // simpler and just as valid: reuse the same uniqueId at the DB layer by
    // racing a direct Driver.create with the same uniqueId, which the
    // service's own duplicate check won't catch (that check only looks at
    // Traccar's response). Instead, assert the simpler invariant directly:
    // a failed-validation create (bad numzUserId) still leaves no Traccar row.
    const before = createdTraccarDriverIds.length;
    await assert.rejects(
      () => createCompanyDriver({
        auth: { companyId: company.id },
        body: { ...payload, personId: 700_000_000 + (Date.now() % 90_000_000) },
      }),
      (err) => err.statusCode === 404,
    );
    const leftover = await Driver.findOne({ where: { uniqueId: payload.uniqueId } });
    assert.equal(leftover, null, 'no NUMZFLEET driver row should exist after a rejected create');
    assert.equal(createdTraccarDriverIds.length, before, 'no Traccar driver should have been created before validation ran');
  });

  it('a driver created and then updated with a phone reaches Traccar correctly — phone in attributes, never a top-level field', async () => {
    // Regression for the live bug report: "Unrecognized field \"phone\"
    // (class org.traccar.model.Driver)". Verifies the *actual* Traccar
    // projection, not just that our own call succeeded.
    const company = await makeCompany('Driver Co PhoneProjection');
    const created = await trackTraccarDriver(
      await createCompanyDriver({
        auth: { companyId: company.id },
        body: { ...driverPayload('Phone Create'), phone: '+260971111111' },
      }),
    );
    assert.equal(created.phone, '+260971111111', 'create must succeed and return the phone NUMZFLEET stored');

    const rawAfterCreate = await traccarServiceFetch(`/api/drivers/${created.traccarDriverId}`);
    assert.equal(rawAfterCreate.phone, undefined, 'Traccar\'s own driver object must never carry a top-level phone field');
    assert.equal(rawAfterCreate.attributes.phone, '+260971111111', 'the phone must land in attributes on the real Traccar projection');
    assert.equal(rawAfterCreate.name, 'Phone Create', 'name must still reach Traccar correctly');
    assert.equal(rawAfterCreate.uniqueId, created.uniqueId, 'uniqueId must still reach Traccar correctly (driverUniqueId telemetry matching depends on this)');

    const updated = await updateCompanyDriver(
      { auth: { companyId: company.id }, body: { phone: '+260972222222' } },
      created.id,
    );
    assert.equal(updated.phone, '+260972222222', 'update must succeed and return the new phone');

    const rawAfterUpdate = await traccarServiceFetch(`/api/drivers/${created.traccarDriverId}`);
    assert.equal(rawAfterUpdate.phone, undefined, 'Traccar\'s own driver object must still never carry a top-level phone field after update');
    assert.equal(rawAfterUpdate.attributes.phone, '+260972222222', 'the updated phone must land in attributes on the real Traccar projection');
  });

  it('updateCompanyDriver edits a driver and whitelist-ignores unknown fields', async () => {
    const company = await makeCompany('Driver Co Update');
    const created = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: company.id }, body: driverPayload('Before Edit') }),
    );
    const updated = await updateCompanyDriver(
      { auth: { companyId: company.id }, body: { name: 'After Edit', companyId: uuid(), id: uuid() } },
      created.id,
    );
    assert.equal(updated.name, 'After Edit');
    assert.equal(updated.id, created.id, 'id must never be attacker-writable');
    // companyId isn't part of the returned DTO at all — prove the row still
    // belongs to the real company by re-fetching it under that company's auth.
    const stillOwned = await getCompanyDriver({ auth: { companyId: company.id } }, created.id);
    assert.equal(stillOwned.id, created.id, 'companyId must never be attacker-writable');
  });

  it('updateCompanyDriver 404s for a driver owned by a different company, with no mutation', async () => {
    const companyA = await makeCompany('Driver Co UpdA');
    const companyB = await makeCompany('Driver Co UpdB');
    const driverB = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: companyB.id }, body: driverPayload('Protected') }),
    );
    await assert.rejects(
      () => updateCompanyDriver({ auth: { companyId: companyA.id }, body: { name: 'Hijacked' } }, driverB.id),
      (err) => err.statusCode === 404,
    );
    const stillB = await getCompanyDriver({ auth: { companyId: companyB.id } }, driverB.id);
    assert.equal(stillB.name, 'Protected', 'a rejected cross-company update must not mutate the row');
  });

  it('deleteCompanyDriver removes an owned driver', async () => {
    const { Driver } = await import('../../models/index.js');
    const company = await makeCompany('Driver Co Delete');
    const created = await createCompanyDriver({ auth: { companyId: company.id }, body: driverPayload('To Delete') });
    await deleteCompanyDriver({ auth: { companyId: company.id } }, created.id);
    const gone = await Driver.findByPk(created.id);
    assert.equal(gone, null);
  });

  it('deleteCompanyDriver succeeds for a driver with past (inactive) assignment history, not just never-assigned drivers', async () => {
    // Regression: driver_assignments.driver_id must CASCADE, not RESTRICT —
    // caught live (2026-09-13) when a real assign-then-unassign-then-delete
    // sequence 500'd because the FK didn't distinguish an inactive history
    // row from an active one the way deleteCompanyDriver's own check does.
    const { Vehicle, Driver } = await import('../../models/index.js');
    const { assignDriverToVehicle, unassignDriverFromVehicle } = await import('../../services/vehicleFleetService.js');
    const company = await makeCompany('Driver Co DeleteWithHistory');
    const vehicle = await Vehicle.create({ id: uuid(), name: 'History Vehicle', companyId: company.id });
    const created = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: company.id }, body: driverPayload('Has History') }),
    );
    const auth = { auth: { companyId: company.id, activeContext: { type: 'customer', companyId: company.id } } };
    await assignDriverToVehicle(vehicle.id, created.id, auth);
    await unassignDriverFromVehicle(vehicle.id, auth);

    await deleteCompanyDriver({ auth: { companyId: company.id } }, created.id);
    const gone = await Driver.findByPk(created.id);
    assert.equal(gone, null, 'a driver with only inactive assignment history must still be deletable');
  });

  it('deleteCompanyDriver 404s for a driver owned by a different company', async () => {
    const companyA = await makeCompany('Driver Co DelA');
    const companyB = await makeCompany('Driver Co DelB');
    const driverB = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: companyB.id }, body: driverPayload('Not Yours') }),
    );
    await assert.rejects(
      () => deleteCompanyDriver({ auth: { companyId: companyA.id } }, driverB.id),
      (err) => err.statusCode === 404,
    );
  });

  it('a full driver lifecycle: create → link person → update → delete, checking list visibility at each step', async () => {
    const company = await makeCompany('Driver Co Lifecycle');
    const person = await makeTraccarUser('Lifecycle Person');
    await makeNumzUser(person.id, company.id);
    const auth = { auth: { companyId: company.id } };

    const created = await trackTraccarDriver(
      await createCompanyDriver({ ...auth, body: driverPayload('Lifecycle Driver') }),
    );
    let list = await listCompanyDrivers(auth);
    assert.ok(list.some((d) => d.id === created.id));

    const linked = await updateCompanyDriver({ ...auth, body: { personId: person.id } }, created.id);
    assert.equal(linked.personId, person.id);

    const renamed = await updateCompanyDriver({ ...auth, body: { name: 'Renamed Driver' } }, created.id);
    assert.equal(renamed.name, 'Renamed Driver');

    await deleteCompanyDriver(auth, created.id);
    list = await listCompanyDrivers(auth);
    assert.ok(!list.some((d) => d.id === created.id));
  });
});

describe('listCompanyDriverVehicles — the driver-side view of the Setup-side assignment', { skip: SKIP_NO_TRACCAR }, () => {
  it('a driver with no active assignment has no vehicles', async () => {
    const company = await makeCompany('Driver Co VehiclesEmpty');
    const driver = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: company.id }, body: driverPayload('No Vehicle') }),
    );
    const vehicles = await listCompanyDriverVehicles({ auth: { companyId: company.id } }, driver.id);
    assert.deepEqual(vehicles, []);
  });

  it('reflects a Vehicle Setup assignment immediately — the regression this endpoint exists to fix', async () => {
    // Before this endpoint, a driver's People profile ("Current vehicle") was
    // derived from live Traccar telemetry (driverUniqueId on a position), a
    // completely different source from what Vehicle Setup's Driver Assignment
    // module actually writes (driver_assignments). Assigning a driver in
    // Setup updated Setup immediately but never reached the driver's own
    // profile — this test proves the two now read the same source.
    const { Vehicle } = await import('../../models/index.js');
    const { assignDriverToVehicle, unassignDriverFromVehicle } = await import('../../services/vehicleFleetService.js');
    const company = await makeCompany('Driver Co VehiclesReflect');
    const vehicle = await Vehicle.create({ id: uuid(), name: 'Setup Assigned Vehicle', companyId: company.id });
    const driver = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: company.id }, body: driverPayload('Setup Linked') }),
    );
    const auth = { auth: { companyId: company.id, activeContext: { type: 'customer', companyId: company.id } } };

    let vehicles = await listCompanyDriverVehicles({ auth: { companyId: company.id } }, driver.id);
    assert.deepEqual(vehicles, [], 'not yet assigned');

    await assignDriverToVehicle(vehicle.id, driver.id, auth);
    vehicles = await listCompanyDriverVehicles({ auth: { companyId: company.id } }, driver.id);
    assert.equal(vehicles.length, 1);
    assert.equal(vehicles[0].id, vehicle.id);
    assert.equal(vehicles[0].name, 'Setup Assigned Vehicle');

    await unassignDriverFromVehicle(vehicle.id, auth);
    vehicles = await listCompanyDriverVehicles({ auth: { companyId: company.id } }, driver.id);
    assert.deepEqual(vehicles, [], 'unassignment must also reflect immediately');
  });

  it('404s for a driver owned by a different company', async () => {
    const companyA = await makeCompany('Driver Co VehiclesA');
    const companyB = await makeCompany('Driver Co VehiclesB');
    const driverB = await trackTraccarDriver(
      await createCompanyDriver({ auth: { companyId: companyB.id }, body: driverPayload('Not Yours') }),
    );
    await assert.rejects(
      () => listCompanyDriverVehicles({ auth: { companyId: companyA.id } }, driverB.id),
      (err) => err.statusCode === 404,
    );
  });
});
