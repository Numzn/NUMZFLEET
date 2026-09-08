/**
 * Vehicle Visibility Audit — Phase 4 scenario 11 (a normal user cannot
 * bypass company scoping by directly requesting another company's
 * vehicle/device id) plus the D3 (mutation IDOR) and D4 (device-hijack)
 * fixes it depends on, and the D5 (company_id NOT NULL) guarantee they lean
 * on. Synthetic, test-prefixed companies/vehicles/devices only.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  updateVehicle,
  deleteVehicle,
  updateVehicleMergedConfig,
  saveRoutineServiceForVehicle,
  assignDevice,
} from './vehicleFleetService.js';

const TEST_SLUG_PREFIX = 'vehicletenancy-';
let nextDeviceId = 810_000_000 + (Date.now() % 90_000_000);
const freshDeviceId = () => nextDeviceId++;

const createdVehicleIds = [];
const createdCompanyDeviceIds = [];

after(async () => {
  const { Company, Vehicle, CompanyDevice } = await import('../models/index.js');
  if (createdCompanyDeviceIds.length) {
    await CompanyDevice.destroy({ where: { id: { [Op.in]: createdCompanyDeviceIds } } });
  }
  if (createdVehicleIds.length) {
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

async function makeVehicle(companyId, name) {
  const { Vehicle } = await import('../models/index.js');
  const vehicle = await Vehicle.create({ name, companyId });
  createdVehicleIds.push(vehicle.id);
  return vehicle;
}

function customerAuth(companyId) {
  return { activeContext: { type: 'customer', companyId }, accessibleCustomerIds: [] };
}

function platformAuth() {
  return { activeContext: { type: 'platform', companyId: null }, accessibleCustomerIds: [] };
}

describe('Vehicle Visibility Audit — cross-company vehicle mutation is blocked (D3)', () => {
  it('updateVehicle: a different company cannot rename another company\'s vehicle by id', async () => {
    const owner = await makeCompany('Owner Co');
    const attacker = await makeCompany('Attacker Co');
    const vehicle = await makeVehicle(owner.id, 'Victim Vehicle');

    await assert.rejects(
      () => updateVehicle(vehicle.id, { name: 'Renamed' }, customerAuth(attacker.id)),
      (err) => err.statusCode === 404,
    );
  });

  it('updateVehicle: the owning company can still rename its own vehicle', async () => {
    const owner = await makeCompany('Owner Co 2');
    const vehicle = await makeVehicle(owner.id, 'Own Vehicle');

    const updated = await updateVehicle(vehicle.id, { name: 'Renamed Own' }, customerAuth(owner.id));
    assert.equal(updated.name, 'Renamed Own');
  });

  it('deleteVehicle: a different company cannot delete another company\'s vehicle by id', async () => {
    const owner = await makeCompany('Owner Co 3');
    const attacker = await makeCompany('Attacker Co 3');
    const vehicle = await makeVehicle(owner.id, 'Victim Vehicle 3');

    await assert.rejects(
      () => deleteVehicle(vehicle.id, customerAuth(attacker.id)),
      (err) => err.statusCode === 404,
    );

    const { Vehicle } = await import('../models/index.js');
    const stillThere = await Vehicle.findByPk(vehicle.id);
    assert.ok(stillThere, 'vehicle must survive a rejected cross-company delete attempt');
  });

  it('updateVehicleMergedConfig: a different company is rejected before any config is touched', async () => {
    const owner = await makeCompany('Owner Co 4');
    const attacker = await makeCompany('Attacker Co 4');
    const vehicle = await makeVehicle(owner.id, 'Victim Vehicle 4');

    await assert.rejects(
      () => updateVehicleMergedConfig(vehicle.id, { name: 'Hijacked' }, customerAuth(attacker.id)),
      (err) => err.statusCode === 404,
    );
  });

  it('saveRoutineServiceForVehicle: a different company is rejected before touching Traccar', async () => {
    const owner = await makeCompany('Owner Co 5');
    const attacker = await makeCompany('Attacker Co 5');
    const vehicle = await makeVehicle(owner.id, 'Victim Vehicle 5');

    await assert.rejects(
      () => saveRoutineServiceForVehicle(
        vehicle.id,
        { intervalKm: 5000, startingOdometerKm: 100 },
        customerAuth(attacker.id),
      ),
      (err) => err.statusCode === 404,
    );
  });

  it('platform callers are not blocked by the company check', async () => {
    const owner = await makeCompany('Owner Co 6');
    const vehicle = await makeVehicle(owner.id, 'Platform-visible Vehicle');

    const updated = await updateVehicle(vehicle.id, { name: 'Platform Renamed' }, platformAuth());
    assert.equal(updated.name, 'Platform Renamed');
  });
});

describe('Vehicle Visibility Audit — device reassignment cannot hijack another company\'s device (D4)', () => {
  it('assignDevice: rejects claiming a device already assigned to a different company', async () => {
    const ownerA = await makeCompany('Device Owner A');
    const ownerB = await makeCompany('Device Owner B');
    const vehicleB = await makeVehicle(ownerB.id, 'Company B Vehicle');
    const device = freshDeviceId();

    const { CompanyDevice } = await import('../models/index.js');
    const link = await CompanyDevice.create({
      id: uuid(), companyId: ownerA.id, traccarDeviceId: device, isActive: true,
    });
    createdCompanyDeviceIds.push(link.id);

    await assert.rejects(
      () => assignDevice(vehicleB.id, device, { auth: customerAuth(ownerB.id) }),
      (err) => err.statusCode === 409,
    );
  });
});

describe('Vehicle Visibility Audit — vehicles.company_id cannot be NULL (D5)', () => {
  it('Vehicle.create rejects a missing companyId', async () => {
    const { Vehicle } = await import('../models/index.js');
    await assert.rejects(() => Vehicle.create({ name: 'No Company Vehicle (test)' }));
  });
});
