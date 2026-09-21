/**
 * Device onboarding — createCompanyDevice() establishes NUMZFLEET company
 * ownership (company_devices, vehicleId: null) at the moment a Traccar
 * device is created, rather than only once a vehicle assignment writes the
 * first ownership row. Exercises the real Traccar admin API end to end
 * (same convention as companyProvisioningService.test.js): creates and
 * deletes real, disposable Traccar devices/groups scoped to this file only.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { createCompanyDevice } from './deviceProvisioningService.js';
import { ensureDeviceInCompany } from './companyProvisioningService.js';
import { traccarServiceFetch } from './traccarServiceClient.js';
import { getAccessibleTraccarDeviceIds } from './fleetDeviceSnapshotService.js';
import { assignDevice } from './vehicleFleetService.js';

const TEST_SLUG_PREFIX = 'deviceprovisioning-';
const createdTraccarDeviceIds = [];
const createdVehicleIds = [];

// Same rationale as companyProvisioningService.test.js: only the dev stack
// has a real Traccar reachable — CI's quality-checks job does not.
const SKIP_NO_TRACCAR = (process.env.TRACCAR_API_USER && process.env.TRACCAR_API_PASSWORD)
  ? false
  : 'requires a live Traccar (TRACCAR_API_USER/TRACCAR_API_PASSWORD not set) — not available in CI yet';

after(async () => {
  const {
    Company, CompanyDevice, Vehicle, DeviceAssignment,
  } = await import('../models/index.js');
  const companies = await Company.findAll({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  if (createdVehicleIds.length) {
    await DeviceAssignment.destroy({ where: { vehicleId: { [Op.in]: createdVehicleIds } } });
    await Vehicle.destroy({ where: { id: { [Op.in]: createdVehicleIds } } });
  }
  await CompanyDevice.destroy({ where: { companyId: { [Op.in]: companies.map((c) => c.id) } } });
  await Company.destroy({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  for (const company of companies) {
    if (company.traccarGroupId) {
      await traccarServiceFetch(`/api/groups/${company.traccarGroupId}`, { method: 'DELETE' }).catch(() => {});
    }
  }
  for (const id of createdTraccarDeviceIds) {
    await traccarServiceFetch(`/api/devices/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  // Tests D and E exercise assignDevice(), which reads a device via
  // getTraccarDevice() — the shared, long-lived Traccar MySQL pool
  // (config/traccar.js's getTraccarPool). Nothing else in this file needs
  // it, so without an explicit close it's the one lingering handle keeping
  // this process alive after the last test finishes (same gotcha documented
  // in immobilizationIntentService.stateMachine.test.js).
  const { closeTraccarConnection } = await import('../config/traccar.js');
  await closeTraccarConnection();
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

function uniqueDeviceId() {
  return `${TEST_SLUG_PREFIX}${uuid().substring(0, 12)}`;
}

describe('createCompanyDevice', { skip: SKIP_NO_TRACCAR }, () => {
  it('A: creates a Traccar device and immediately establishes company ownership with vehicleId: null', async () => {
    const company = await makeCompany('Create Owns Co');
    const uniqueId = uniqueDeviceId();

    const device = await createCompanyDevice(company.id, { name: 'Truck GPS 001', uniqueId });
    createdTraccarDeviceIds.push(device.id);

    assert.equal(device.uniqueId, uniqueId);

    const { CompanyDevice } = await import('../models/index.js');
    const link = await CompanyDevice.findOne({ where: { traccarDeviceId: device.id } });
    assert.ok(link, 'company_devices row must exist immediately after creation');
    assert.equal(link.companyId, company.id);
    assert.equal(link.vehicleId, null);
    assert.equal(link.isActive, true);
  });

  it('B: the newly created, unassigned device is accessible to its own company via the snapshot path', async () => {
    const company = await makeCompany('Create Accessible Co');
    const uniqueId = uniqueDeviceId();

    const device = await createCompanyDevice(company.id, { name: 'Truck GPS 002', uniqueId });
    createdTraccarDeviceIds.push(device.id);

    const ids = await getAccessibleTraccarDeviceIds({
      activeContext: { type: 'customer', companyId: company.id },
      accessibleCustomerIds: [],
    });
    assert.ok(ids.includes(device.id), 'device must appear in its own company\'s accessible ids with no vehicle yet');
  });

  it('C: a different company cannot see the newly created device (server-side, not frontend filtering)', async () => {
    const owner = await makeCompany('Create Owner C');
    const stranger = await makeCompany('Create Stranger C');
    const uniqueId = uniqueDeviceId();

    const device = await createCompanyDevice(owner.id, { name: 'Truck GPS 003', uniqueId });
    createdTraccarDeviceIds.push(device.id);

    const ids = await getAccessibleTraccarDeviceIds({
      activeContext: { type: 'customer', companyId: stranger.id },
      accessibleCustomerIds: [],
    });
    assert.ok(!ids.includes(device.id), 'a different company must never see this device');
  });

  it('D: a different company cannot claim the device via assignDevice (existing cross-company protection still holds)', async () => {
    const owner = await makeCompany('Create Owner D');
    const stranger = await makeCompany('Create Stranger D');
    const uniqueId = uniqueDeviceId();

    const device = await createCompanyDevice(owner.id, { name: 'Truck GPS 004', uniqueId });
    createdTraccarDeviceIds.push(device.id);

    const { Vehicle } = await import('../models/index.js');
    const strangerVehicle = await Vehicle.create({ name: 'Stranger Vehicle D', companyId: stranger.id });
    createdVehicleIds.push(strangerVehicle.id);

    await assert.rejects(
      () => assignDevice(strangerVehicle.id, device.id, {
        auth: { activeContext: { type: 'customer', companyId: stranger.id }, accessibleCustomerIds: [] },
      }),
      (err) => err.statusCode === 409,
    );
  });

  it('E: the owning company can still assign its onboarded (previously unassigned) device to one of its own vehicles', async () => {
    const owner = await makeCompany('Create Owner E');
    const uniqueId = uniqueDeviceId();

    const device = await createCompanyDevice(owner.id, { name: 'Truck GPS 005', uniqueId });
    createdTraccarDeviceIds.push(device.id);

    const { Vehicle, CompanyDevice } = await import('../models/index.js');
    const vehicle = await Vehicle.create({ name: 'Owner E Vehicle', companyId: owner.id });
    createdVehicleIds.push(vehicle.id);

    const merged = await assignDevice(vehicle.id, device.id, {
      auth: { activeContext: { type: 'customer', companyId: owner.id }, accessibleCustomerIds: [] },
    });
    assert.equal(merged.id, vehicle.id);

    const link = await CompanyDevice.findOne({ where: { traccarDeviceId: device.id } });
    assert.equal(link.vehicleId, vehicle.id, 'ownership row must gain the vehicleId once assigned');
    assert.equal(link.companyId, owner.id, 'ownership must remain with the same company throughout');
  });

  it('F: rejects when name or uniqueId is missing, before ever contacting Traccar', async () => {
    const company = await makeCompany('Validation Co');
    await assert.rejects(
      () => createCompanyDevice(company.id, { name: '' , uniqueId: uniqueDeviceId() }),
      (err) => err.statusCode === 400,
    );
    await assert.rejects(
      () => createCompanyDevice(company.id, { name: 'No Unique Id' }),
      (err) => err.statusCode === 400,
    );
  });

  it('G: rejects when no company is resolved (unprovisioned identity), before ever contacting Traccar', async () => {
    await assert.rejects(
      () => createCompanyDevice(null, { name: 'Orphan Device', uniqueId: uniqueDeviceId() }),
      (err) => err.statusCode === 403,
    );
  });

  it('H: ensureDeviceInCompany is idempotent — calling it twice for the same device does not create a duplicate ownership row', async () => {
    const company = await makeCompany('Idempotent Co');
    const uniqueId = uniqueDeviceId();

    const device = await createCompanyDevice(company.id, { name: 'Truck GPS 006', uniqueId });
    createdTraccarDeviceIds.push(device.id);

    await ensureDeviceInCompany(company.id, device.id, null);
    await ensureDeviceInCompany(company.id, device.id, null);

    const { CompanyDevice } = await import('../models/index.js');
    const links = await CompanyDevice.findAll({ where: { traccarDeviceId: device.id } });
    assert.equal(links.length, 1, 'repeated calls must not create duplicate ownership rows');
  });

  it('I: Traccar device creation succeeds but ownership registration failure is compensated (device is deleted, not left orphaned)', async () => {
    const uniqueId = uniqueDeviceId();
    const nonExistentCompanyId = uuid(); // syntactically valid, no Company row

    await assert.rejects(
      () => createCompanyDevice(nonExistentCompanyId, { name: 'Should Not Survive', uniqueId }),
    );

    // The compensating delete in createCompanyDevice should have removed the
    // Traccar device it just created — verify it's actually gone, not merely
    // that our own bookkeeping thinks so.
    const rows = await traccarServiceFetch(`/api/devices?uniqueId=${encodeURIComponent(uniqueId)}`);
    assert.equal(rows.length, 0, 'orphaned Traccar device must have been cleaned up, not left behind');

    const { CompanyDevice } = await import('../models/index.js');
    const link = await CompanyDevice.findOne({ where: { companyId: nonExistentCompanyId } });
    assert.equal(link, null, 'no ownership row must exist for a company that was never created');
  });
});
