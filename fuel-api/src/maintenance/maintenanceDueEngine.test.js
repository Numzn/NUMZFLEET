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
  const position = { attributes: { totalDistance: 9500 } };
  const due = computeDue(m, position);
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
  const due = computeDue(m, { attributes: { totalDistance: 10000000 } });
  assert.equal(due.remaining, 0);
  assert.equal(due.isActionable, true);
  assert.equal(due.isOverdue, false);
});

test('computeDue: past the due point is overdue and the next due point does not roll forward', () => {
  const m = { id: 4, name: 'Service', type: 'totalDistance', start: 5000000, period: 5000000 };
  const due = computeDue(m, { attributes: { totalDistance: 10500000 } });
  assert.equal(due.nextDue, 10000000);
  assert.equal(due.remaining, -500000);
  assert.equal(due.isOverdue, true);
  assert.equal(classifyDueBucket(due), 'overdue');
});

test('formatRemainingLabel says "Due now" when exactly due, not "Due in 0 km"', () => {
  const item = { unknown: false, remaining: 0, isOverdue: false, isTime: false, type: 'totalDistance' };
  assert.equal(formatRemainingLabel(item), 'Due now');
});
