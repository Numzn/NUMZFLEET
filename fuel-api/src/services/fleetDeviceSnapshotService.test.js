/**
 * Vehicle Visibility Audit — Phase 4, scenarios 1-10 and 12, rebuilt on the
 * authoritative source: vehicles.company_id + active device_assignments
 * (not the best-effort company_devices cache — see the rebuild's rationale
 * in fleetDeviceSnapshotService.js).
 *
 * Named after the real business example this work was raised against
 * (Default: Toyota Allion; I-TRACK: BOOMER, LIGHT TRUCK, JUKE) but built on
 * synthetic, test-prefixed companies/vehicles and fake Traccar device ids —
 * never the real production rows.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { getAccessibleTraccarDeviceIds } from './fleetDeviceSnapshotService.js';

const TEST_SLUG_PREFIX = 'devicesnapshot-';
let nextDeviceId = 800_000_000 + (Date.now() % 90_000_000);
const freshDeviceId = () => nextDeviceId++;

const createdVehicleIds = [];

after(async () => {
  const { Company, Vehicle, DeviceAssignment } = await import('../models/index.js');
  const sequelize = (await import('../config/database.js')).default;
  if (createdVehicleIds.length) {
    await DeviceAssignment.destroy({ where: { vehicleId: { [Op.in]: createdVehicleIds } } });
    // A background scheduler in the running fuel-api server (not this test)
    // can independently evaluate any vehicle's activity state and write an
    // audit row for it while these tests are executing — delete via raw SQL
    // rather than importing every model that might reference vehicles.id.
    await sequelize.query(
      'DELETE FROM vehicle_state_audit_events WHERE "vehicleId" IN (:ids)',
      { replacements: { ids: createdVehicleIds } },
    );
    await Vehicle.destroy({ where: { id: { [Op.in]: createdVehicleIds } } });
  }
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
});

async function makeCompany(name) {
  const { Company } = await import('../models/index.js');
  return Company.create({
    id: uuid(),
    slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`,
    name,
    organizationType: 'customer',
    status: 'active',
  });
}

/** Registers a vehicle for companyId with an active device assignment — the authoritative link. */
async function makeAssignedVehicle(companyId, vehicleName, traccarDeviceId) {
  const { Vehicle, DeviceAssignment } = await import('../models/index.js');
  const vehicle = await Vehicle.create({ name: vehicleName, companyId });
  createdVehicleIds.push(vehicle.id);
  await DeviceAssignment.create({
    vehicleId: vehicle.id, deviceId: traccarDeviceId, isActive: true, assignedAt: new Date(),
  });
  return vehicle;
}

function customerAuth(companyId) {
  return { activeContext: { type: 'customer', companyId }, accessibleCustomerIds: [] };
}

function platformAuth() {
  return { activeContext: { type: 'platform', companyId: null }, accessibleCustomerIds: [] };
}

describe('Vehicle Visibility Audit — company-scoped device snapshot, sourced from device_assignments', () => {
  it('scenarios 1-4: a Default-company user sees only their own device (Toyota Allion), never I-TRACK\'s (BOOMER, LIGHT TRUCK, JUKE)', async () => {
    const defaultCo = await makeCompany('Default (test)');
    const itrack = await makeCompany('I-TRACK (test)');

    const toyotaAllion = freshDeviceId();
    const boomer = freshDeviceId();
    const lightTruck = freshDeviceId();
    const juke = freshDeviceId();

    await makeAssignedVehicle(defaultCo.id, 'TOYOTA ALLION', toyotaAllion);
    await makeAssignedVehicle(itrack.id, 'BOOMER', boomer);
    await makeAssignedVehicle(itrack.id, 'LIGHT TRUCK', lightTruck);
    await makeAssignedVehicle(itrack.id, 'JUKE', juke);

    const ids = await getAccessibleTraccarDeviceIds(customerAuth(defaultCo.id));

    assert.ok(ids.includes(toyotaAllion), 'Default user must see their own vehicle');
    assert.ok(!ids.includes(boomer), 'Default user must not see I-TRACK\'s BOOMER');
    assert.ok(!ids.includes(lightTruck), 'Default user must not see I-TRACK\'s LIGHT TRUCK');
    assert.ok(!ids.includes(juke), 'Default user must not see I-TRACK\'s JUKE');
  });

  it('scenarios 5-8: an I-TRACK user sees BOOMER, LIGHT TRUCK and JUKE, never Default\'s Toyota Allion', async () => {
    const defaultCo = await makeCompany('Default (test) 2');
    const itrack = await makeCompany('I-TRACK (test) 2');

    const toyotaAllion = freshDeviceId();
    const boomer = freshDeviceId();
    const lightTruck = freshDeviceId();
    const juke = freshDeviceId();

    await makeAssignedVehicle(defaultCo.id, 'TOYOTA ALLION', toyotaAllion);
    await makeAssignedVehicle(itrack.id, 'BOOMER', boomer);
    await makeAssignedVehicle(itrack.id, 'LIGHT TRUCK', lightTruck);
    await makeAssignedVehicle(itrack.id, 'JUKE', juke);

    const ids = await getAccessibleTraccarDeviceIds(customerAuth(itrack.id));

    assert.ok(ids.includes(boomer), 'I-TRACK user must see BOOMER');
    assert.ok(ids.includes(lightTruck), 'I-TRACK user must see LIGHT TRUCK');
    assert.ok(ids.includes(juke), 'I-TRACK user must see JUKE');
    assert.ok(!ids.includes(toyotaAllion), 'I-TRACK user must not see Default\'s Toyota Allion');
  });

  it('scenario 9: reassigning a VEHICLE from Default to I-TRACK updates effective visibility both ways', async () => {
    const defaultCo = await makeCompany('Default (test) 3');
    const itrack = await makeCompany('I-TRACK (test) 3');
    const device = freshDeviceId();
    const vehicle = await makeAssignedVehicle(defaultCo.id, 'Movable Vehicle', device);

    let defaultIds = await getAccessibleTraccarDeviceIds(customerAuth(defaultCo.id));
    let itrackIds = await getAccessibleTraccarDeviceIds(customerAuth(itrack.id));
    assert.ok(defaultIds.includes(device));
    assert.ok(!itrackIds.includes(device));

    await vehicle.update({ companyId: itrack.id });

    defaultIds = await getAccessibleTraccarDeviceIds(customerAuth(defaultCo.id));
    itrackIds = await getAccessibleTraccarDeviceIds(customerAuth(itrack.id));
    assert.ok(!defaultIds.includes(device), 'must disappear from the old company once its vehicle is reassigned');
    assert.ok(itrackIds.includes(device), 'must appear for the new company once its vehicle is reassigned');
  });

  it('scenario 9b: reassigning just the DEVICE to a different vehicle/company (assignDevice\'s path) also updates visibility both ways', async () => {
    const ownerA = await makeCompany('Device Owner A (test)');
    const ownerB = await makeCompany('Device Owner B (test)');
    const device = freshDeviceId();
    const { Vehicle, DeviceAssignment } = await import('../models/index.js');
    const vehicleA = await Vehicle.create({ name: 'Vehicle A', companyId: ownerA.id });
    const vehicleB = await Vehicle.create({ name: 'Vehicle B', companyId: ownerB.id });
    createdVehicleIds.push(vehicleA.id, vehicleB.id);
    const assignment = await DeviceAssignment.create({
      vehicleId: vehicleA.id, deviceId: device, isActive: true, assignedAt: new Date(),
    });

    let aIds = await getAccessibleTraccarDeviceIds(customerAuth(ownerA.id));
    assert.ok(aIds.includes(device));

    // Simulate assignDevice's own transaction: deactivate the old assignment, create a new active one.
    await assignment.update({ isActive: false, unassignedAt: new Date() });
    await DeviceAssignment.create({
      vehicleId: vehicleB.id, deviceId: device, isActive: true, assignedAt: new Date(),
    });

    aIds = await getAccessibleTraccarDeviceIds(customerAuth(ownerA.id));
    const bIds = await getAccessibleTraccarDeviceIds(customerAuth(ownerB.id));
    assert.ok(!aIds.includes(device), 'Company A must lose the device once its assignment is deactivated');
    assert.ok(bIds.includes(device), 'Company B must gain the device via the new active assignment');
  });

  it('scenario 10: reassigning a vehicle from I-TRACK back to Default updates effective visibility both ways', async () => {
    const defaultCo = await makeCompany('Default (test) 4');
    const itrack = await makeCompany('I-TRACK (test) 4');
    const device = freshDeviceId();
    const vehicle = await makeAssignedVehicle(itrack.id, 'Movable Vehicle 2', device);

    await vehicle.update({ companyId: defaultCo.id });

    const defaultIds = await getAccessibleTraccarDeviceIds(customerAuth(defaultCo.id));
    const itrackIds = await getAccessibleTraccarDeviceIds(customerAuth(itrack.id));
    assert.ok(defaultIds.includes(device));
    assert.ok(!itrackIds.includes(device));
  });

  it('scenario 12: a platform administrator\'s snapshot spans every company', async () => {
    const defaultCo = await makeCompany('Default (test) 5');
    const itrack = await makeCompany('I-TRACK (test) 5');
    const toyotaAllion = freshDeviceId();
    const boomer = freshDeviceId();
    await makeAssignedVehicle(defaultCo.id, 'TOYOTA ALLION', toyotaAllion);
    await makeAssignedVehicle(itrack.id, 'BOOMER', boomer);

    const ids = await getAccessibleTraccarDeviceIds(platformAuth());

    assert.ok(ids.includes(toyotaAllion));
    assert.ok(ids.includes(boomer));
  });

  it('a company with no vehicles gets an empty snapshot, not an error', async () => {
    const emptyCo = await makeCompany('Empty (test)');
    const ids = await getAccessibleTraccarDeviceIds(customerAuth(emptyCo.id));
    assert.deepEqual(ids, []);
  });

  it('a NEW vehicle with no device assigned yet contributes nothing (not a spurious null/NaN id)', async () => {
    const { Vehicle } = await import('../models/index.js');
    const company = await makeCompany('New Vehicle Co (test)');
    const vehicle = await Vehicle.create({ name: 'Brand New Vehicle', companyId: company.id });
    createdVehicleIds.push(vehicle.id);

    const ids = await getAccessibleTraccarDeviceIds(customerAuth(company.id));
    assert.deepEqual(ids, []);
  });
});
