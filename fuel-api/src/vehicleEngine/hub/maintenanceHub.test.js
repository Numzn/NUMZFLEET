import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { buildMaintenanceHub } = await import('./maintenanceHub.js');

const KM = 1000;

function fakeDeps(onFacts) {
  return {
    fetchMaintenanceFacts: async (companyId, fleetVehicleId, options) => {
      onFacts({ companyId, fleetVehicleId, options });
      return {
        items: [{
          id: 5,
          name: 'Routine Service',
          type: 'totalDistance',
          deviceId: 62,
          current: 125400 * KM,
          remaining: 4600 * KM,
          nextDue: 130000 * KM,
          period: 5000 * KM,
          start: 125000 * KM,
          attributes: { numzServicePackage: true },
        }],
        kpis: {},
        healthScore: 95,
      };
    },
    listServiceRecords: async () => [],
    aggregateMaintenanceCosts: async () => ({}),
    summarizeForVehicle: async () => ({}),
    findLatestCompletedForMaintenance: async () => null,
  };
}

test('the hub hands the caller\'s odometer to the maintenance loader, so page and schedule share one number', async () => {
  let seen;
  await buildMaintenanceHub('co-1', 'veh-1', { odometerKm: 125400 }, fakeDeps((call) => { seen = call; }));
  assert.deepEqual(seen.options, { odometerKm: 125400 });
});

test('with no options the hub lets the loader resolve the odometer itself', async () => {
  let seen;
  await buildMaintenanceHub('co-1', 'veh-1', undefined, fakeDeps((call) => { seen = call; }));
  assert.deepEqual(seen.options, {});
});

test('the hub exposes the schedule exactly as measured: current mileage and remaining distance', async () => {
  const hub = await buildMaintenanceHub('co-1', 'veh-1', { odometerKm: 125400 }, fakeDeps(() => {}));
  const [schedule] = hub.schedules;
  assert.equal(schedule.current, 125400 * KM);
  assert.equal(schedule.remaining, 4600 * KM);
  assert.equal(schedule.nextDue, 130000 * KM);
});
