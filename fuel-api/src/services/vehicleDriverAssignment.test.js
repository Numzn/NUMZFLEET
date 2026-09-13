import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import { assignDriverToVehicle, unassignDriverFromVehicle, getVehicleDriverDto } from './vehicleFleetService.js';
import { createCompanyDriver } from '../modules/drivers/driverService.js';
import { traccarServiceFetch } from './traccarServiceClient.js';

// Real Postgres + real Traccar (driver creation projects into Traccar
// synchronously) — same skip convention as driverService.test.js.
const TEST_SLUG_PREFIX = 'vehicledriverassign-';
const createdTraccarDriverIds = [];

const SKIP_NO_TRACCAR = (process.env.TRACCAR_API_USER && process.env.TRACCAR_API_PASSWORD)
  ? false
  : 'requires a live Traccar (TRACCAR_API_USER/TRACCAR_API_PASSWORD not set) — not available in CI yet';

after(async () => {
  const { Company, Vehicle, Driver, DriverAssignment } = await import('../models/index.js');
  const companies = await Company.findAll({ where: { slug: { [Op.like]: `${TEST_SLUG_PREFIX}%` } } });
  const companyIds = companies.map((c) => c.id);
  if (companyIds.length) {
    const vehicles = await Vehicle.findAll({ where: { companyId: { [Op.in]: companyIds } } });
    const vehicleIds = vehicles.map((v) => v.id);
    if (vehicleIds.length) {
      await DriverAssignment.destroy({ where: { vehicleId: { [Op.in]: vehicleIds } } });
    }
    await Driver.destroy({ where: { companyId: { [Op.in]: companyIds } } });
    await Vehicle.destroy({ where: { companyId: { [Op.in]: companyIds } } });
    await Company.destroy({ where: { id: { [Op.in]: companyIds } } });
  }
  for (const id of createdTraccarDriverIds) {
    await traccarServiceFetch(`/api/drivers/${id}`, { method: 'DELETE' }).catch(() => {});
  }
});

async function makeCompany(name) {
  const { Company } = await import('../models/index.js');
  return Company.create({
    id: uuid(), slug: `${TEST_SLUG_PREFIX}${uuid().substring(0, 8)}`, name, organizationType: 'customer', status: 'active',
  });
}

async function makeVehicle(companyId, name) {
  const { Vehicle } = await import('../models/index.js');
  return Vehicle.create({ id: uuid(), name, companyId });
}

async function makeDriver(companyId, name) {
  const driver = await createCompanyDriver({
    auth: { companyId },
    body: { name, uniqueId: `${TEST_SLUG_PREFIX}${uuid().substring(0, 12)}` },
  });
  if (driver.traccarDriverId != null) createdTraccarDriverIds.push(driver.traccarDriverId);
  return driver;
}

describe('assignDriverToVehicle / unassignDriverFromVehicle — the authoritative Driver ↔ Vehicle relationship', { skip: SKIP_NO_TRACCAR }, () => {
  it('Company A driver → Company A vehicle succeeds and is reflected by getVehicleDriverDto', async () => {
    const company = await makeCompany('VDA Co Own');
    const vehicle = await makeVehicle(company.id, 'Own Vehicle');
    const driver = await makeDriver(company.id, 'Own Driver');

    const result = await assignDriverToVehicle(vehicle.id, driver.id, { auth: { companyId: company.id, activeContext: { type: 'customer', companyId: company.id } } });
    assert.equal(result.driver.id, driver.id);

    const dto = await getVehicleDriverDto(vehicle.id);
    assert.equal(dto.id, driver.id);
    assert.equal(dto.name, 'Own Driver');
  });

  it('Company A driver → Company B vehicle fails', async () => {
    const companyA = await makeCompany('VDA Co A1');
    const companyB = await makeCompany('VDA Co B1');
    const driverA = await makeDriver(companyA.id, 'Driver A1');
    const vehicleB = await makeVehicle(companyB.id, 'Vehicle B1');

    await assert.rejects(
      () => assignDriverToVehicle(vehicleB.id, driverA.id, { auth: { companyId: companyA.id, activeContext: { type: 'customer', companyId: companyA.id } } }),
      (err) => err.statusCode === 403 || err.statusCode === 409,
      'a Company A identity must not be able to reach a Company B vehicle at all, and even if it could, the driver/vehicle company mismatch must still be refused',
    );
    const dto = await getVehicleDriverDto(vehicleB.id);
    assert.equal(dto, null, 'the rejected assignment must not have been saved');
  });

  it('Company B driver → Company A vehicle fails', async () => {
    const companyA = await makeCompany('VDA Co A2');
    const companyB = await makeCompany('VDA Co B2');
    const driverB = await makeDriver(companyB.id, 'Driver B2');
    const vehicleA = await makeVehicle(companyA.id, 'Vehicle A2');

    await assert.rejects(
      () => assignDriverToVehicle(vehicleA.id, driverB.id, { auth: { companyId: companyA.id, activeContext: { type: 'customer', companyId: companyA.id } } }),
      (err) => err.statusCode === 403 || err.statusCode === 409,
    );
    const dto = await getVehicleDriverDto(vehicleA.id);
    assert.equal(dto, null);
  });

  it('even a caller who can independently access both companies (platform-style auth) is refused a mismatched pairing', async () => {
    // canAccessCompany alone is not the invariant — driver.companyId must
    // equal vehicle.companyId regardless of who is asking. Simulate an
    // identity whose canAccessCompany would pass for both by using the
    // same company for the auth token's own companyId is not applicable
    // here (canAccessCompany requires activeContext.type === 'platform' for
    // cross-company reach) — assert directly against a real platform-typed
    // auth object.
    const companyA = await makeCompany('VDA Co PlatformA');
    const companyB = await makeCompany('VDA Co PlatformB');
    const driverA = await makeDriver(companyA.id, 'Platform Driver A');
    const vehicleB = await makeVehicle(companyB.id, 'Platform Vehicle B');

    await assert.rejects(
      () => assignDriverToVehicle(vehicleB.id, driverA.id, { auth: { companyId: companyA.id, activeContext: { type: 'platform', companyId: null } } }),
      (err) => err.statusCode === 409,
      'platform-level company access must not bypass the driver/vehicle company-match invariant',
    );
  });

  it('unknown driver id fails with 404', async () => {
    const company = await makeCompany('VDA Co UnkDriver');
    const vehicle = await makeVehicle(company.id, 'Vehicle For Unknown Driver');
    await assert.rejects(
      () => assignDriverToVehicle(vehicle.id, uuid(), { auth: { companyId: company.id, activeContext: { type: 'customer', companyId: company.id } } }),
      (err) => err.statusCode === 404,
    );
  });

  it('unknown vehicle id fails with 404', async () => {
    const company = await makeCompany('VDA Co UnkVehicle');
    const driver = await makeDriver(company.id, 'Driver For Unknown Vehicle');
    await assert.rejects(
      () => assignDriverToVehicle(uuid(), driver.id, { auth: { companyId: company.id, activeContext: { type: 'customer', companyId: company.id } } }),
      (err) => err.statusCode === 404,
    );
  });

  it('assigning a new driver replaces (not duplicates) the active assignment, preserving history', async () => {
    const { DriverAssignment } = await import('../models/index.js');
    const company = await makeCompany('VDA Co Replace');
    const vehicle = await makeVehicle(company.id, 'Replace Vehicle');
    const driver1 = await makeDriver(company.id, 'First Driver');
    const driver2 = await makeDriver(company.id, 'Second Driver');
    const auth = { auth: { companyId: company.id, activeContext: { type: 'customer', companyId: company.id } } };

    await assignDriverToVehicle(vehicle.id, driver1.id, auth);
    await assignDriverToVehicle(vehicle.id, driver2.id, auth);

    const active = await DriverAssignment.findAll({ where: { vehicleId: vehicle.id, isActive: true } });
    assert.equal(active.length, 1, 'exactly one active assignment per vehicle');
    assert.equal(active[0].driverId, driver2.id);

    const history = await DriverAssignment.findAll({ where: { vehicleId: vehicle.id } });
    assert.equal(history.length, 2, 'the first assignment must be deactivated, not deleted');
  });

  it('unassignDriverFromVehicle clears the active assignment and is idempotent', async () => {
    const company = await makeCompany('VDA Co Unassign');
    const vehicle = await makeVehicle(company.id, 'Unassign Vehicle');
    const driver = await makeDriver(company.id, 'Unassign Driver');
    const auth = { auth: { companyId: company.id, activeContext: { type: 'customer', companyId: company.id } } };

    await assignDriverToVehicle(vehicle.id, driver.id, auth);
    await unassignDriverFromVehicle(vehicle.id, auth);
    assert.equal(await getVehicleDriverDto(vehicle.id), null);

    // second unassign on an already-clear vehicle must not throw
    await unassignDriverFromVehicle(vehicle.id, auth);
  });
});
