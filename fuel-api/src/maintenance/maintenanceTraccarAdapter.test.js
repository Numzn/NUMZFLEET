import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { loadVehicleMaintenanceDueState, loadCompanyMaintenanceDueState } = await import('./maintenanceTraccarAdapter.js');

const KM = 1000;
const schedule = (deviceId) => ({
  id: 5,
  name: 'Routine Service',
  type: 'totalDistance',
  start: 125000 * KM,
  period: 5000 * KM,
  attributes: { numzServicePackage: true },
  deviceId,
});

/** Fake collaborators. The tracker counter reads 1,000 km more than the real odometer. */
function fakes(over = {}) {
  const resolved = [];
  const deps = {
    getCompanyDeviceIds: async () => [62, 63],
    findActiveAssignment: async () => ({ deviceId: 62, Vehicle: { name: 'ALLION', plateNumber: 'CAC 4222' } }),
    loadMaintenancesForDevices: async (ids) => ids.map(schedule),
    loadLatestPositions: async (ids) => ids.map((deviceId) => ({ deviceId, attributes: { totalDistance: 126400 * KM } })),
    loadFleetVehicleMap: async () => new Map([
      [62, { fleetVehicleId: 'veh-62', name: 'ALLION', plateNumber: 'CAC 4222' }],
      [63, { fleetVehicleId: 'veh-63', name: 'HILUX', plateNumber: 'BAA 1111' }],
    ]),
    resolveOdometer: async (deviceId) => { resolved.push(deviceId); return { odometerKm: 125400 }; },
    ...over,
  };
  return { deps, resolved };
}

test('vehicle: uses the odometer the caller already resolved, and does not resolve a second one', async () => {
  const { deps, resolved } = fakes();
  const state = await loadVehicleMaintenanceDueState('co-1', 'veh-62', { odometerKm: 125400 }, deps);

  assert.deepEqual(resolved, [], 'no second odometer resolution');
  assert.equal(state.items[0].current, 125400 * KM);
  assert.equal(state.items[0].remaining, 4600 * KM);
});

test('vehicle: the raw tracker counter never becomes the maintenance mileage', async () => {
  const { deps } = fakes();
  const state = await loadVehicleMaintenanceDueState('co-1', 'veh-62', { odometerKm: 125400 }, deps);
  assert.notEqual(state.items[0].current, 126400 * KM);
});

test('vehicle: a caller-supplied null means "unknown" — no fallback to resolving or to the raw counter', async () => {
  const { deps, resolved } = fakes();
  const state = await loadVehicleMaintenanceDueState('co-1', 'veh-62', { odometerKm: null }, deps);

  assert.deepEqual(resolved, []);
  assert.equal(state.items[0].unknown, true);
  assert.equal(state.items[0].remaining, null);
});

test('vehicle: with no caller value it resolves the canonical odometer itself', async () => {
  const { deps, resolved } = fakes();
  const state = await loadVehicleMaintenanceDueState('co-1', 'veh-62', {}, deps);

  assert.deepEqual(resolved, [62]);
  assert.equal(state.items[0].current, 125400 * KM);
  assert.equal(state.items[0].remaining, 4600 * KM);
});

test('company: devices the caller already resolved are not resolved again; the rest are', async () => {
  const { deps, resolved } = fakes();
  const state = await loadCompanyMaintenanceDueState('co-1', { odometerKmByDevice: new Map([[62, 125400]]) }, deps);

  assert.deepEqual(resolved, [63], 'only the device the caller did not supply');
  const byVehicle = new Map(state.items.map((item) => [item.fleetVehicleId, item]));
  assert.equal(byVehicle.get('veh-62').current, 125400 * KM);
  assert.equal(byVehicle.get('veh-63').current, 125400 * KM);
});

test('company: a supplied null for a device means unknown for that device', async () => {
  const { deps, resolved } = fakes();
  const state = await loadCompanyMaintenanceDueState('co-1', { odometerKmByDevice: new Map([[62, null], [63, 125400]]) }, deps);

  assert.deepEqual(resolved, []);
  const byVehicle = new Map(state.items.map((item) => [item.fleetVehicleId, item]));
  assert.equal(byVehicle.get('veh-62').unknown, true);
  assert.equal(byVehicle.get('veh-63').unknown, false);
});

test('company: with nothing supplied every device resolves the canonical odometer', async () => {
  const { deps, resolved } = fakes();
  const state = await loadCompanyMaintenanceDueState('co-1', {}, deps);

  assert.deepEqual(resolved.sort(), [62, 63]);
  assert.ok(state.items.every((item) => item.current === 125400 * KM));
});
