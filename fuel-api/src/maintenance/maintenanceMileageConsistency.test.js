import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { computeDue, classifyDueBucket, formatRemainingLabel } = await import('./maintenanceDueEngine.js');
const { routineRemainingKm } = await import('./routineServiceStatus.js');
const { buildRoutineServiceSummaryByVehicle } = await import('./routineServiceSummary.js');
const { buildImmediateAttention } = await import('../services/maintenanceOperationsService.js');
const { buildMaintenanceEngine } = await import('../vehicleEngine/engine/maintenanceEngine.js');
const { resolveOdometerKm } = await import('../vehicleEngine/odometer/resolveOdometer.js');

/**
 * One vehicle, one Routine Service schedule, one set of telemetry. Every place that
 * reports "km remaining" — the maintenance dashboard, the notification summary, the
 * fleet list and the vehicle page — must report the SAME number, and it must be
 * measured against the canonical odometer, not the raw tracker counter.
 */

const KM = 1000;

const SCENARIOS = [
  // label, anchor, anchor's tracker reading, tracker reading now, cycle start, interval, expected remaining km
  ['tracker counter 1,000 km AHEAD of the real odometer', 125000, 126000, 126400, 125000, 5000, 4600],
  ['tracker counter far BEHIND the real odometer (tracker fitted later)', 125000, 4000, 4400, 125000, 5000, 4600],
  ['tracker counter equal to the odometer', 125000, 125000, 125400, 125000, 5000, 4600],
  ['overdue, tracker counter ahead', 125000, 126000, 131500, 125000, 5000, -500],
  ['exactly due, tracker counter ahead', 125000, 126000, 131000, 125000, 5000, 0],
  ['no anchor: odometer is the tracker counter itself', null, null, 125400, 125000, 5000, 4600],
];

function itemFor({ anchorKm, anchorTelemetryKm, rawKm, startKm, intervalKm }) {
  const { odometerKm } = resolveOdometerKm({ anchorKm, anchorTelemetryKm, currentTelemetryKm: rawKm });
  const schedule = {
    id: 5,
    name: 'Routine Service',
    type: 'totalDistance',
    start: startKm * KM,
    period: intervalKm * KM,
    attributes: { numzServicePackage: true },
  };
  // Exactly what the maintenance adapter does: raw position + the canonical odometer.
  const position = { attributes: { totalDistance: rawKm * KM } };
  const due = computeDue(schedule, position, odometerKm == null ? null : odometerKm * KM);
  return {
    odometerKm,
    item: {
      ...due,
      deviceId: 62,
      fleetVehicleId: 'veh-1',
      vehicleName: 'ALLION',
      plateNumber: 'CAC 4222',
      bucket: classifyDueBucket(due),
      remainingLabel: formatRemainingLabel(due),
    },
  };
}

for (const [label, anchorKm, anchorTelemetryKm, rawKm, startKm, intervalKm, expected] of SCENARIOS) {
  test(`every consumer agrees: ${label}`, () => {
    const { odometerKm, item } = itemFor({ anchorKm, anchorTelemetryKm, rawKm, startKm, intervalKm });

    const shared = routineRemainingKm(item);
    const summary = buildRoutineServiceSummaryByVehicle({ items: [item] }).get('veh-1').remainingKm;
    const [attention] = buildImmediateAttention({ items: [item] }, new Map());
    const engine = buildMaintenanceEngine({
      maintenance: { schedules: [item], scheduleKpis: {}, workOrders: { summary: {} }, routineLastService: null },
    }, { odometerKm }).nextService.remainingKm;

    assert.equal(shared, expected, 'shared calculation');
    assert.equal(summary, expected, 'notification / fleet-list summary');
    assert.equal(engine, expected, 'vehicle page');
    if (expected !== null && attention) assert.equal(attention.remainingKm, expected, 'dashboard attention list');
  });
}

test('the vehicle page does not recompute remaining km from its own odometer', () => {
  // The schedule item was measured against 125,400 km. If the page were to subtract the
  // registry odometer itself, a different registry value would change the answer; the
  // page must report the item's own figure.
  const { item } = itemFor({ anchorKm: 125000, anchorTelemetryKm: 126000, rawKm: 126400, startKm: 125000, intervalKm: 5000 });
  const engine = buildMaintenanceEngine({
    maintenance: { schedules: [item], scheduleKpis: {}, workOrders: { summary: {} }, routineLastService: null },
  }, { odometerKm: 99999 });
  assert.equal(engine.nextService.remainingKm, 4600);
});

test('with no canonical odometer every consumer says "unknown", not a number', () => {
  const { item } = itemFor({ anchorKm: null, anchorTelemetryKm: null, rawKm: null, startKm: 125000, intervalKm: 5000 });
  assert.equal(item.unknown, true);
  assert.equal(routineRemainingKm(item), null);
  assert.equal(buildRoutineServiceSummaryByVehicle({ items: [item] }).get('veh-1').remainingKm, null);
  const engine = buildMaintenanceEngine({
    maintenance: { schedules: [item], scheduleKpis: {}, workOrders: { summary: {} }, routineLastService: null },
  }, { odometerKm: null });
  assert.equal(engine.nextService.remainingKm, null);
  assert.equal(engine.nextService.status, null);
});
