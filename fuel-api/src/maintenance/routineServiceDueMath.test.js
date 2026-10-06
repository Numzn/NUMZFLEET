import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

const { computeDue, classifyDueBucket, formatRemainingLabel } = await import('./maintenanceDueEngine.js');
const { deriveRoutineServiceStatus, routineRemainingKm } = await import('./routineServiceStatus.js');
const { buildRoutineServiceSummaryByVehicle } = await import('./routineServiceSummary.js');
const { computeRebasedStart } = await import('./routineServiceTraccarService.js');
const { buildImmediateAttention } = await import('../services/maintenanceOperationsService.js');
const { shouldRebaseScheduleOnCompletion } = await import('../services/serviceRecordService.js');
const { buildMaintenanceEngine } = await import('../vehicleEngine/engine/maintenanceEngine.js');

/**
 * The maintenance cycle advances ONLY when a service is completed. Passing the due
 * point must leave the service due — remaining goes negative, status becomes
 * Overdue — instead of silently rolling to the next multiple of the interval.
 */

const KM = 1000;

// A Routine Service: last service / configured at 5,000 km, every 5,000 km.
const routineSchedule = {
  id: 5,
  name: 'Routine Service',
  type: 'totalDistance',
  start: 5000 * KM,
  period: 5000 * KM,
  attributes: { numzServicePackage: true },
};

/** A due-engine item exactly as maintenanceTraccarAdapter builds it. */
function dueItem(odometerKm, schedule = routineSchedule) {
  const due = computeDue(schedule, { attributes: { totalDistance: odometerKm * KM } });
  return {
    ...due,
    deviceId: 62,
    fleetVehicleId: 'veh-1',
    vehicleName: 'ALLION',
    plateNumber: 'CAC 4222',
    bucket: classifyDueBucket(due),
    remainingLabel: formatRemainingLabel(due),
  };
}

/** The same item as the vehicle engine receives it through the maintenance hub. */
function engineFor(item, odometerKm) {
  return buildMaintenanceEngine({
    maintenance: {
      schedules: [item],
      scheduleKpis: {},
      scheduleHealthScore: null,
      workOrders: { summary: {} },
      routineLastService: null,
    },
  }, { odometerKm });
}

const CASES = [
  // [label, odometer km, remaining km, status, urgency on the dashboard]
  ['400 km before due', 9600, 400, 'due_soon', 'due_soon'],
  ['100 km before due', 9900, 100, 'prepare', 'due_today'],
  ['exactly due', 10000, 0, 'due_now', 'due_today'],
  ['1 km overdue', 10001, -1, 'overdue', 'overdue'],
  ['500 km overdue', 10500, -500, 'overdue', 'overdue'],
  ['substantially overdue (7,300 km)', 17300, -7300, 'overdue', 'overdue'],
];

for (const [label, odometerKm, remainingKm, status, urgency] of CASES) {
  test(`due math: ${label} -> ${status}; next due stays at 10,000 km`, () => {
    const item = dueItem(odometerKm);

    // The calculation itself.
    assert.equal(item.nextDue, 10000 * KM, 'next due must be start + period, never rolled forward');
    assert.equal(item.remaining, remainingKm * KM);
    assert.equal(item.isOverdue, remainingKm < 0, 'overdue only once strictly past the due point');
    assert.equal(routineRemainingKm(item), remainingKm);
    assert.equal(deriveRoutineServiceStatus(routineRemainingKm(item)).status, status);

    // The per-vehicle summary (feeds notifications).
    const summary = buildRoutineServiceSummaryByVehicle({ items: [item] }).get('veh-1');
    assert.equal(summary.status, status);
    assert.equal(summary.remainingKm, remainingKm);
    assert.equal(summary.nextServiceAtKm, 10000);

    // The Maintenance dashboard's attention list.
    const [attention] = buildImmediateAttention({ items: [item] }, new Map());
    assert.equal(attention.status, status);
    assert.equal(attention.remainingKm, remainingKm);
    assert.equal(attention.nextServiceAtKm, 10000);
    assert.equal(attention.urgency, urgency);

    // The vehicle maintenance view (vehicle engine).
    const engine = engineFor(item, odometerKm);
    assert.equal(engine.nextService.status, status);
    assert.equal(engine.nextService.remainingKm, remainingKm);
    assert.equal(engine.nextService.nextServiceAtKm, 10000);
    assert.equal(engine.overdueCount, status === 'overdue' ? 1 : 0);
  });
}

test('the exact example: start 5,000, period 5,000, odometer 10,500 -> next due 10,000, remaining -500, Overdue', () => {
  const item = dueItem(10500);
  assert.equal(item.nextDue / KM, 10000);
  assert.equal(item.remaining / KM, -500);
  assert.equal(item.bucket, 'overdue');
  assert.equal(buildRoutineServiceSummaryByVehicle({ items: [item] }).get('veh-1').statusLabel, 'Overdue');
  assert.match(item.remainingLabel, /500 km overdue/);
});

test('exactly due is "Service Due", actionable, and not yet overdue', () => {
  const item = dueItem(10000);
  assert.equal(item.isOverdue, false);
  assert.equal(item.isActionable, true);
  assert.equal(item.remainingLabel, 'Due now');
  assert.equal(buildRoutineServiceSummaryByVehicle({ items: [item] }).get('veh-1').statusLabel, 'Service Due');
});

test('far from due is On Track and does not appear in the dashboard attention list', () => {
  const item = dueItem(5200);
  assert.equal(item.remaining / KM, 4800);
  assert.equal(buildRoutineServiceSummaryByVehicle({ items: [item] }).get('veh-1').status, 'on_track');
  assert.deepEqual(buildImmediateAttention({ items: [item] }, new Map()), []);
});

test('the cycle never advances by itself: next due is constant for every odometer value', () => {
  let previousRemaining = Infinity;
  for (let odometerKm = 5000; odometerKm <= 40000; odometerKm += 250) {
    const item = dueItem(odometerKm);
    assert.equal(item.nextDue, 10000 * KM, `next due rolled at ${odometerKm} km`);
    assert.ok(item.remaining < previousRemaining, 'remaining must keep decreasing as the odometer grows');
    previousRemaining = item.remaining;
  }
});

test('an odometer below the cycle start is not overdue and still measures from start + period', () => {
  const item = dueItem(4000);
  assert.equal(item.nextDue / KM, 10000);
  assert.equal(item.isOverdue, false);
  assert.equal(item.remaining / KM, 6000);
});

test('a verified odometer is used when it is ahead of a stale tracker counter', () => {
  const due = computeDue(routineSchedule, { attributes: { totalDistance: 9000 * KM } }, 10500 * KM);
  assert.equal(due.current / KM, 10500);
  assert.equal(due.remaining / KM, -500);
  assert.equal(due.isOverdue, true);
});

test('time-based schedules do not roll forward either: a missed date stays overdue', () => {
  const day = 86400000;
  const schedule = {
    id: 9, name: 'Inspection', type: 'fixTime', start: Date.now() - 400 * day, period: 365 * day, attributes: {},
  };
  const due = computeDue(schedule, null);
  assert.equal(due.nextDue, schedule.start + schedule.period);
  assert.equal(due.isOverdue, true);
  assert.ok(due.remaining < 0 && due.remaining > -40 * day, 'about 35 days overdue');
  assert.equal(classifyDueBucket(due), 'overdue');
});

// ---------------------------------------------------------------------------
// Completion: the cycle advances only when the service is actually completed,
// and it restarts from the odometer the service was actually done at.
// ---------------------------------------------------------------------------

test('completing an overdue service restarts the cycle from the completion odometer (10,500 -> next 15,500)', () => {
  assert.equal(dueItem(10500).isOverdue, true, 'precondition: the service is overdue');

  const newStart = computeRebasedStart({ type: 'totalDistance', completionOdometerKm: 10500 });
  assert.equal(newStart, 10500 * KM);

  const rebased = { ...routineSchedule, start: newStart };
  const after = dueItem(10500, rebased);
  assert.equal(after.nextDue / KM, 15500);
  assert.equal(after.remaining / KM, 5000);
  assert.equal(after.isOverdue, false);
  assert.equal(buildRoutineServiceSummaryByVehicle({ items: [after] }).get('veh-1').status, 'on_track');
  assert.deepEqual(buildImmediateAttention({ items: [after] }, new Map()), []);
});

test('the new cycle starts at the odometer the service was done at, not at the old due point or the current reading', () => {
  // Overdue at 10,500 km; the workshop's recorded odometer for the service is 10,420 km.
  const newStart = computeRebasedStart({ type: 'totalDistance', completionOdometerKm: 10420 });
  assert.equal(newStart, 10420 * KM);
  assert.notEqual(newStart, 10000 * KM);
  assert.notEqual(newStart, 10500 * KM);
  const after = dueItem(10500, { ...routineSchedule, start: newStart });
  assert.equal(after.nextDue / KM, 15420);
  assert.equal(after.remaining / KM, 4920);
});

test('a time-based schedule restarts from "now" on completion', () => {
  const now = 1_800_000_000_000;
  assert.equal(computeRebasedStart({ type: 'serverTime', completionOdometerKm: null, now }), now);
});

test('a distance schedule cannot be rebased without a completion odometer (it must not guess)', () => {
  for (const value of [null, undefined, 'abc', NaN]) {
    assert.throws(
      () => computeRebasedStart({ type: 'totalDistance', completionOdometerKm: value }),
      (error) => error.statusCode === 400,
      `odometer=${String(value)}`,
    );
  }
});

test('only the transition into "completed" advances the schedule', () => {
  const linked = { maintenanceId: 5, deviceId: 62 };
  // Moving into completed, once: rebase.
  assert.equal(shouldRebaseScheduleOnCompletion({ nextStatus: 'completed', wasCompleted: false, ...linked }), true);
  // Anything that is not completion: the schedule must stay put.
  for (const nextStatus of ['scheduled', 'open', 'in_progress', 'awaiting_parts', undefined]) {
    assert.equal(
      shouldRebaseScheduleOnCompletion({ nextStatus, wasCompleted: false, ...linked }),
      false,
      `status ${String(nextStatus)} must not rebase`,
    );
  }
  // Editing a record that was already completed must not rebase a second time.
  assert.equal(shouldRebaseScheduleOnCompletion({ nextStatus: 'completed', wasCompleted: true, ...linked }), false);
  // Not linked to a schedule, or no device to read: nothing to rebase.
  assert.equal(shouldRebaseScheduleOnCompletion({ nextStatus: 'completed', wasCompleted: false, maintenanceId: null, deviceId: 62 }), false);
  assert.equal(shouldRebaseScheduleOnCompletion({ nextStatus: 'completed', wasCompleted: false, maintenanceId: 5, deviceId: null }), false);
});
