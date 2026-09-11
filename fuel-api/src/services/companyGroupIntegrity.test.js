/**
 * Phase 2 — "one NUMZFLEET company = exactly one dedicated Traccar group =
 * only that company's devices."
 *
 * These tests are hermetic: the Traccar side is injected, so nothing here
 * creates a real Traccar group. That is deliberate on two counts. Per
 * docs/TENANCY_ARCHITECTURE.md §11 tenancy tests must prove themselves with no
 * Traccar running, and the existing provisioning suites that DO call Traccar
 * for real are exactly why the dev instance has accumulated hundreds of
 * abandoned "NumzTrak — ... Test Co" groups.
 *
 * Postgres is real, because company ownership is a Postgres fact and the
 * one-group-per-company guarantee is enforced by a real unique index.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sequelize, { Company, Vehicle, DeviceAssignment } from '../models/index.js';
import { ensureCompanyTraccarGroup } from './companyProvisioningService.js';
import { getAccessibleTraccarDeviceIds } from './fleetDeviceSnapshotService.js';

let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

const SLUG_PREFIX = 'groupintegrity';
const created = { companies: [], vehicles: [] };

async function makeCompany(name, traccarGroupId = null) {
  const company = await Company.create({
    id: randomUUID(),
    slug: `${SLUG_PREFIX}-${randomUUID().slice(0, 8)}`,
    name,
    status: 'active',
    traccarGroupId,
  });
  created.companies.push(company.id);
  return company;
}

async function makeVehicleWithDevice(company, deviceId, name) {
  const vehicle = await Vehicle.create({ id: randomUUID(), name, companyId: company.id });
  created.vehicles.push(vehicle.id);
  await DeviceAssignment.create({
    id: randomUUID(), vehicleId: vehicle.id, deviceId, isActive: true,
  });
  return vehicle;
}

/** Records every Traccar interaction so tests can assert what was and wasn't called. */
function traccarSpy({ existingGroups = [], nextGroupId = 9001 } = {}) {
  const calls = { groupExists: [], createGroup: [], claimedByAnother: [] };
  const known = new Set(existingGroups);
  return {
    calls,
    deps: {
      groupExists: async (id) => { calls.groupExists.push(id); return known.has(id); },
      createGroup: async (company) => { calls.createGroup.push(company.id); return nextGroupId; },
    },
  };
}

describe('company -> Traccar group integrity', { skip: !dbReachable && 'database not reachable' }, () => {
  after(async () => {
    if (!dbReachable) return;
    await DeviceAssignment.destroy({ where: { vehicleId: created.vehicles } });
    await Vehicle.destroy({ where: { id: created.vehicles } });
    await Company.destroy({ where: { id: created.companies } });
  });

  it('keeps a stored group that still exists, and does not create a second one', async () => {
    const company = await makeCompany('Group Integrity Keeper', 4242);
    const spy = traccarSpy({ existingGroups: [4242] });

    const result = await ensureCompanyTraccarGroup(company.id, spy.deps);

    assert.equal(result.traccarGroupId, 4242, 'the existing group must be kept');
    assert.deepEqual(spy.calls.createGroup, [], 'must not create a group when one already exists');
  });

  it('detects a deleted group and safely recreates it', async () => {
    // The exact aftermath of deleting a Traccar group: tc_devices.groupid is
    // set NULL, tc_user_group cascades away, and companies.traccar_group_id is
    // left pointing at an id that no longer exists.
    const company = await makeCompany('Group Integrity Orphan', 7777);
    const spy = traccarSpy({ existingGroups: [], nextGroupId: 8123 });

    const result = await ensureCompanyTraccarGroup(company.id, spy.deps);

    assert.deepEqual(spy.calls.groupExists, [7777], 'the stored id must be verified, not trusted');
    assert.equal(spy.calls.createGroup.length, 1, 'a replacement group must be created');
    assert.equal(result.traccarGroupId, 8123);

    await company.reload();
    assert.equal(company.traccarGroupId, 8123, 'the new group id must be persisted');
  });

  it('never adopts a group another company already owns', async () => {
    const owner = await makeCompany('Group Integrity Rightful Owner', 5150);
    // A second company pointing at the same group: the exact shape that would
    // put two companies' devices behind one group's permissions.
    const contender = await makeCompany('Group Integrity Contender');
    await contender.update({ traccarGroupId: 5150 }, { hooks: false, validate: false })
      .catch(() => { /* unique index may already refuse it — that is the point */ });

    const spy = traccarSpy({ existingGroups: [5150], nextGroupId: 6001 });
    const result = await ensureCompanyTraccarGroup(contender.id, spy.deps);

    assert.notEqual(result.traccarGroupId, 5150, 'must not share the other company\'s group');
    assert.equal(result.traccarGroupId, 6001, 'must get a dedicated group of its own');

    await owner.reload();
    assert.equal(owner.traccarGroupId, 5150, 'the rightful owner keeps its group');
  });

  it('keeps the stored id when Traccar cannot be reached, rather than spawning duplicates', async () => {
    const company = await makeCompany('Group Integrity Offline', 3131);
    const calls = { createGroup: [] };
    const deps = {
      groupExists: async () => { throw new Error('ECONNREFUSED traccar-mysql:3306'); },
      createGroup: async (c) => { calls.createGroup.push(c.id); return 9999; },
    };

    const result = await ensureCompanyTraccarGroup(company.id, deps);

    assert.equal(result.traccarGroupId, 3131, 'an outage must not change the mapping');
    assert.deepEqual(calls.createGroup, [], 'an outage must never create a replacement group');
  });

  it('enforces one group per company at the database level', async () => {
    const first = await makeCompany('Group Integrity Unique A', 2468);
    const second = await makeCompany('Group Integrity Unique B');

    await assert.rejects(
      () => second.update({ traccarGroupId: 2468 }),
      /unique|duplicate/i,
      'two companies must not be able to share one Traccar group',
    );

    await first.reload();
    assert.equal(first.traccarGroupId, 2468);
  });
});

describe('company device scoping (the I-TRACK shape)', { skip: !dbReachable && 'database not reachable' }, () => {
  after(async () => {
    if (!dbReachable) return;
    await DeviceAssignment.destroy({ where: { vehicleId: created.vehicles } });
    await Vehicle.destroy({ where: { id: created.vehicles } });
    await Company.destroy({ where: { id: created.companies } });
  });

  it('resolves exactly its own devices, and never another company\'s', async () => {
    // Mirrors production: I-TRACK owns devices 5, 6, 8 behind its own group;
    // the default company owns none. Synthetic rows, real device numbers.
    const itrack = await makeCompany('I-TRACK (group integrity)', 2);
    const other = await makeCompany('Default Fleet (group integrity)', 1);

    await makeVehicleWithDevice(itrack, 5, 'BOOMER');
    await makeVehicleWithDevice(itrack, 6, 'LIGHT TRUCK');
    await makeVehicleWithDevice(itrack, 8, 'JUKE');
    await makeVehicleWithDevice(other, 4242, 'Someone Else');

    const itrackAuth = { activeContext: { type: 'customer', companyId: itrack.id } };
    const otherAuth = { activeContext: { type: 'customer', companyId: other.id } };

    const itrackDevices = (await getAccessibleTraccarDeviceIds(itrackAuth)).sort((a, b) => a - b);
    const otherDevices = await getAccessibleTraccarDeviceIds(otherAuth);

    assert.deepEqual(itrackDevices, [5, 6, 8], 'I-TRACK sees exactly its own three devices');
    assert.ok(!otherDevices.includes(5), 'the other company must not reach device 5');
    assert.ok(!otherDevices.includes(6), 'the other company must not reach device 6');
    assert.ok(!otherDevices.includes(8), 'the other company must not reach device 8');
  });

  it('a device belongs to exactly one company, so it cannot sit in two company groups', async () => {
    const a = await makeCompany('Group Integrity Co A');
    const b = await makeCompany('Group Integrity Co B');
    await makeVehicleWithDevice(a, 31337, 'Shared Hardware');

    const aDevices = await getAccessibleTraccarDeviceIds({ activeContext: { type: 'customer', companyId: a.id } });
    const bDevices = await getAccessibleTraccarDeviceIds({ activeContext: { type: 'customer', companyId: b.id } });

    assert.ok(aDevices.includes(31337), 'the owning company reaches its device');
    assert.ok(!bDevices.includes(31337), 'no second company may reach the same device');
    assert.equal(
      [aDevices, bDevices].filter((set) => set.includes(31337)).length,
      1,
      'a device resolves to exactly one company',
    );
  });

  it('ignores any group id a caller supplies and uses the company\'s own', async () => {
    // Distinct group ids: the unique index means no two companies may share
    // one, which is itself the guarantee under test elsewhere in this file.
    const victim = await makeCompany('Group Integrity Victim', 1200);
    await makeVehicleWithDevice(victim, 1205, 'Victim Vehicle');
    const attacker = await makeCompany('Group Integrity Attacker', 9090);

    // A client-supplied groupId/deviceId riding along on the auth object: the
    // scope resolver must read companyId from the authenticated context only.
    const forged = {
      activeContext: { type: 'customer', companyId: attacker.id },
      traccarGroupId: 1200,
      groupId: 1200,
      deviceIds: [1205],
    };

    const devices = await getAccessibleTraccarDeviceIds(forged);

    assert.ok(!devices.includes(1205), 'a supplied group id must not grant another company\'s device');
    assert.deepEqual(devices, [], 'scope comes from the authenticated company, nothing else');
  });
});
