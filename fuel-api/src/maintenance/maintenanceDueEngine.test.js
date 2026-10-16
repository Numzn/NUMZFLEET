import test from 'node:test';
import assert from 'node:assert/strict';

const {
  computeDue,
  classifyDueBucket,
  formatRemainingLabel,
  scoreMaintenance,
  scoreFleetHealth,
} = await import('./maintenanceDueEngine.js');

test('computeDue marks distance maintenance actionable when due soon', () => {
  const m = {
    id: 1,
    name: 'Oil change',
    type: 'totalDistance',
    start: 0,
    period: 10000,
  };
  // 9,500 m on the canonical odometer; the tracker's own counter is irrelevant.
  const due = computeDue(m, { attributes: { totalDistance: 123456 } }, 9500);
  assert.equal(due.unknown, false);
  assert.equal(due.dueSoon, true);
  assert.equal(due.isActionable, true);
});

test('computeDue marks time maintenance due soon within 10% of period', () => {
  const now = Date.now();
  const period = 30 * 86400000;
  const m = {
    id: 2,
    name: 'Annual service',
    type: 'serverTime',
    start: now - period + 86400000,
    period,
  };
  const due = computeDue(m, null);
  assert.equal(due.isTime, true);
  assert.equal(due.dueSoon, true);
  assert.equal(due.isActionable, true);
});

test('classifyDueBucket returns overdue for past-due items', () => {
  const item = { isActionable: true, isOverdue: true, unknown: false, isTime: false, dueSoon: false };
  assert.equal(classifyDueBucket(item), 'overdue');
});

test('formatRemainingLabel shows km for distance maintenance', () => {
  const item = {
    unknown: false,
    remaining: 5000,
    isOverdue: false,
    isTime: false,
    type: 'totalDistance',
  };
  assert.match(formatRemainingLabel(item), /5/);
});

test('scoreMaintenance penalizes overdue items', () => {
  const items = [
    { isActionable: true, isOverdue: true },
    { isActionable: true, isOverdue: true },
  ];
  const score = scoreMaintenance(items);
  assert.ok(score < 55);
});

test('scoreFleetHealth averages vehicle scores', () => {
  assert.equal(scoreFleetHealth([80, 90, 100]), 90);
  assert.equal(scoreFleetHealth([]), null);
});

test('computeDue: exactly on the due point is actionable but not yet overdue', () => {
  const m = { id: 3, name: 'Service', type: 'totalDistance', start: 5000000, period: 5000000 };
  const due = computeDue(m, { attributes: { totalDistance: 7777777 } }, 10000000);
  assert.equal(due.remaining, 0);
  assert.equal(due.isActionable, true);
  assert.equal(due.isOverdue, false);
});

test('computeDue: past the due point is overdue and the next due point does not roll forward', () => {
  const m = { id: 4, name: 'Service', type: 'totalDistance', start: 5000000, period: 5000000 };
  const due = computeDue(m, { attributes: { totalDistance: 7777777 } }, 10500000);
  assert.equal(due.nextDue, 10000000);
  assert.equal(due.remaining, -500000);
  assert.equal(due.isOverdue, true);
  assert.equal(classifyDueBucket(due), 'overdue');
});

test('formatRemainingLabel says "Due now" when exactly due, not "Due in 0 km"', () => {
  const item = { unknown: false, remaining: 0, isOverdue: false, isTime: false, type: 'totalDistance' };
  assert.equal(formatRemainingLabel(item), 'Due now');
});

// ---------------------------------------------------------------------------
// Maintenance measures distance against the canonical odometer and nothing else.
// The raw tracker counter is evidence the odometer engine consumes; it is not a
// second mileage. (Previously: current = max(raw counter, canonical odometer).)
// ---------------------------------------------------------------------------

const KM = 1000;
const routine = {
  id: 10,
  name: 'Routine Service',
  type: 'totalDistance',
  start: 125000 * KM,
  period: 5000 * KM,
  attributes: { numzServicePackage: true },
};

test('a distance schedule is measured against the canonical odometer, not the raw tracker counter', () => {
  // The tracker counter reads 1,000 km MORE than the real odometer.
  const due = computeDue(routine, { attributes: { totalDistance: 126400 * KM } }, 125400 * KM);
  assert.equal(due.current, 125400 * KM);
  assert.equal(due.remaining, 4600 * KM);
});

test('the raw counter being ahead of, behind or equal to the odometer changes nothing', () => {
  for (const rawKm of [126400, 4400, 125400, 0]) {
    const due = computeDue(routine, { attributes: { totalDistance: rawKm * KM } }, 125400 * KM);
    assert.equal(due.current, 125400 * KM, `raw ${rawKm} km`);
    assert.equal(due.remaining, 4600 * KM, `raw ${rawKm} km`);
  }
});

test('a downward odometer correction lowers the mileage maintenance sees', () => {
  // Corrected from 125,400 to 124,000 while the tracker counter still reads 126,400.
  const due = computeDue(routine, { attributes: { totalDistance: 126400 * KM } }, 124000 * KM);
  assert.equal(due.current, 124000 * KM);
  assert.equal(due.remaining, 6000 * KM);
});

test('without a canonical odometer a distance schedule is unknown and never falls back to the raw counter', () => {
  for (const odometerMeters of [null, undefined]) {
    const due = computeDue(routine, { attributes: { totalDistance: 126400 * KM } }, odometerMeters);
    assert.equal(due.unknown, true);
    assert.equal(due.current, null);
    assert.equal(due.remaining, null);
    assert.equal(due.isActionable, false);
  }
});

test('only totalDistance schedules use the odometer; other attribute types still read their own attribute', () => {
  const hours = { id: 11, name: 'Engine hours', type: 'hours', start: 0, period: 100 * 3600000, attributes: {} };
  const due = computeDue(hours, { attributes: { hours: 40 * 3600000 } }, 125400 * KM);
  assert.equal(due.current, 40 * 3600000);
  assert.equal(due.remaining, 60 * 3600000);
});
