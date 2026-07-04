import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoutineServiceSummaryByVehicle } from './routineServiceSummary.js';

test('buildRoutineServiceSummaryByVehicle: schedule exists -> authoritative entry with intervalKm', () => {
  const map = buildRoutineServiceSummaryByVehicle({
    items: [
      {
        fleetVehicleId: 'veh-1',
        attributes: { numzServicePackage: true },
        type: 'totalDistance',
        period: 5000000, // metres
        nextDue: 6166000,
        remaining: 5000000,
      },
    ],
  });
  const entry = map.get('veh-1');
  assert.ok(entry, 'expected an authoritative entry when a tagged schedule exists');
  assert.equal(entry.intervalKm, 5000);
  assert.equal(entry.nextServiceAtKm, 6166);
});

test('buildRoutineServiceSummaryByVehicle: no tagged schedule -> no entry (authoritative absence)', () => {
  const map = buildRoutineServiceSummaryByVehicle({
    items: [
      {
        fleetVehicleId: 'veh-2',
        attributes: {}, // not tagged numzServicePackage — e.g. an "Annual service" schedule
        type: 'totalDistance',
        period: 365000,
      },
    ],
  });
  assert.equal(map.get('veh-2'), undefined);
});

test('buildRoutineServiceSummaryByVehicle: empty/missing items -> empty map, not an error', () => {
  assert.equal(buildRoutineServiceSummaryByVehicle({}).size, 0);
  assert.equal(buildRoutineServiceSummaryByVehicle({ items: [] }).size, 0);
});
