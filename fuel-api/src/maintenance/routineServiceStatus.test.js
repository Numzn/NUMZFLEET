import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRoutineServiceStatus, routineRemainingKm } from './routineServiceStatus.js';

test('deriveRoutineServiceStatus boundary values', () => {
  assert.deepEqual(deriveRoutineServiceStatus(1001), { status: 'on_track', statusLabel: 'On Track' });
  assert.deepEqual(deriveRoutineServiceStatus(1000), { status: 'upcoming', statusLabel: 'Upcoming Service' });
  assert.deepEqual(deriveRoutineServiceStatus(501), { status: 'upcoming', statusLabel: 'Upcoming Service' });
  assert.deepEqual(deriveRoutineServiceStatus(500), { status: 'due_soon', statusLabel: 'Due Soon' });
  assert.deepEqual(deriveRoutineServiceStatus(101), { status: 'due_soon', statusLabel: 'Due Soon' });
  assert.deepEqual(deriveRoutineServiceStatus(100), { status: 'prepare', statusLabel: 'Prepare for Service' });
  assert.deepEqual(deriveRoutineServiceStatus(1), { status: 'prepare', statusLabel: 'Prepare for Service' });
  assert.deepEqual(deriveRoutineServiceStatus(0), { status: 'due_now', statusLabel: 'Service Due' });
  assert.deepEqual(deriveRoutineServiceStatus(-1), { status: 'overdue', statusLabel: 'Overdue' });
  assert.deepEqual(deriveRoutineServiceStatus(null), { status: null, statusLabel: null });
});

test('routineRemainingKm converts a due item to whole km, negative once past due', () => {
  assert.equal(routineRemainingKm({ type: 'totalDistance', remaining: 400000 }), 400);
  assert.equal(routineRemainingKm({ type: 'totalDistance', remaining: 0 }), 0);
  assert.equal(routineRemainingKm({ type: 'totalDistance', remaining: -500000 }), -500);
  assert.equal(routineRemainingKm({ type: 'totalDistance', remaining: -1000 }), -1);
});

test('routineRemainingKm is null when there is nothing to measure', () => {
  assert.equal(routineRemainingKm({ type: 'totalDistance', remaining: null }), null);
  assert.equal(routineRemainingKm({ type: 'totalDistance' }), null);
  assert.equal(routineRemainingKm({ type: 'hours', remaining: 3600000 }), null);
  assert.equal(routineRemainingKm(null), null);
});

test('a remaining distance just short of due never becomes "-0"', () => {
  // -400 m rounds to -0, which prints as "-0" and compares equal to 0
  const km = routineRemainingKm({ type: 'totalDistance', remaining: -400 });
  assert.ok(Object.is(km, 0), `expected +0, got ${Object.is(km, -0) ? '-0' : km}`);
  assert.equal((km).toLocaleString(), '0');
});

test('the rounding band around the due point: inside it the service is "due now", outside it is clear which side', () => {
  // remaining is in metres; the boundary is half a kilometre either side of zero
  assert.equal(deriveRoutineServiceStatus(routineRemainingKm({ type: 'totalDistance', remaining: 499 })).status, 'due_now');
  assert.equal(deriveRoutineServiceStatus(routineRemainingKm({ type: 'totalDistance', remaining: 0 })).status, 'due_now');
  assert.equal(deriveRoutineServiceStatus(routineRemainingKm({ type: 'totalDistance', remaining: -499 })).status, 'due_now');
  assert.equal(deriveRoutineServiceStatus(routineRemainingKm({ type: 'totalDistance', remaining: 501 })).status, 'prepare');
  assert.equal(deriveRoutineServiceStatus(routineRemainingKm({ type: 'totalDistance', remaining: -501 })).status, 'overdue');
});

test('as the odometer advances the status only ever moves forward through the thresholds', () => {
  // start 10,000 km, 5,000 km interval -> due at 15,000 km; walk the odometer from 13,900 km to 15,100 km
  const order = ['upcoming', 'due_soon', 'prepare', 'due_now', 'overdue'];
  let last = -1;
  for (let odometerKm = 13900; odometerKm <= 15100; odometerKm += 25) {
    const remainingM = (15000 - odometerKm) * 1000;
    const { status } = deriveRoutineServiceStatus(routineRemainingKm({ type: 'totalDistance', remaining: remainingM }));
    const idx = order.indexOf(status);
    assert.ok(idx >= last, `${odometerKm} km: ${status} went backwards`);
    last = idx;
  }
  assert.equal(last, order.indexOf('overdue'));
});

test('a service that has been done restarts the interval from the completion odometer, not before and not after', () => {
  // completing at 15,300 km (300 km late) with a 5,000 km interval: next due at 20,300 km, 5,000 km remaining
  const startAfterCompletion = 15300 * 1000;
  const period = 5000 * 1000;
  const remainingAt = (odometerKm) => startAfterCompletion + period - odometerKm * 1000;
  assert.equal(routineRemainingKm({ type: 'totalDistance', remaining: remainingAt(15300) }), 5000);
  assert.equal(routineRemainingKm({ type: 'totalDistance', remaining: remainingAt(15310) }), 4990);
  assert.equal(deriveRoutineServiceStatus(5000).status, 'on_track');
});
