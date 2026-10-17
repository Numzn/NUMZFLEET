import test from 'node:test';
import assert from 'node:assert/strict';

import { routineBaselineFromVehicle, shouldSaveRoutineService } from './routineBaseline.js';

// A vehicle whose Routine Service was set up at 5,000 km, then completed at 10,500 km: Traccar's schedule start was
// rebased to 10,500, but the cached numzFleetConfig pointer (written only at setup) still says 5,000.
const completedVehicle = {
  routineService: { startingOdometerKm: 10500, intervalKm: 5000, nextServiceAtKm: 15500 },
  fleetConfig: { routineService: { intervalKm: 5000, startingOdometerKm: 5000 } },
};

const formFor = (baseline, overrides = {}) => ({
  routineServiceIntervalKm: String(baseline.intervalKm ?? ''),
  routineServiceStartingOdometerKm: baseline.startingOdometerKm == null ? '' : String(baseline.startingOdometerKm),
  ...overrides,
});

test('the baseline is the real schedule\'s, not the stale cached copy written at setup', () => {
  const b = routineBaselineFromVehicle(completedVehicle);
  assert.equal(b.scheduleExists, true);
  assert.equal(b.startingOdometerKm, 10500);
  assert.equal(b.intervalKm, 5000);
  assert.equal(b.source, 'schedule');
});

test('when the schedule disagrees with the cache on the interval, the schedule wins', () => {
  const b = routineBaselineFromVehicle({
    routineService: { startingOdometerKm: 10500, intervalKm: 7500 },
    fleetConfig: { routineService: { intervalKm: 5000, startingOdometerKm: 5000 } },
  });
  assert.equal(b.intervalKm, 7500);
});

test('an existing schedule with no usable start never falls back to the stale cached start', () => {
  const b = routineBaselineFromVehicle({
    routineService: { startingOdometerKm: null, intervalKm: 5000 },
    fleetConfig: { routineService: { intervalKm: 5000, startingOdometerKm: 5000 } },
  });
  assert.equal(b.scheduleExists, true);
  assert.equal(b.startingOdometerKm, null);
});

test('with no schedule the cached pointer is the best information there is', () => {
  const b = routineBaselineFromVehicle({
    routineService: null,
    fleetConfig: { routineService: { intervalKm: 5000, startingOdometerKm: 8000 } },
  });
  assert.deepEqual(
    { scheduleExists: b.scheduleExists, start: b.startingOdometerKm, interval: b.intervalKm, source: b.source },
    { scheduleExists: false, start: 8000, interval: 5000, source: 'cached' },
  );
});

test('a vehicle with nothing configured has an empty baseline', () => {
  const b = routineBaselineFromVehicle({ routineService: null, fleetConfig: null });
  assert.deepEqual(
    { scheduleExists: b.scheduleExists, start: b.startingOdometerKm, interval: b.intervalKm, source: b.source },
    { scheduleExists: false, start: null, interval: null, source: 'none' },
  );
  assert.equal(routineBaselineFromVehicle(null).scheduleExists, false);
});

test('REGRESSION: saving unrelated setup changes does not re-send the Routine Service baseline', () => {
  const baseline = routineBaselineFromVehicle(completedVehicle);
  assert.equal(shouldSaveRoutineService({ form: formFor(baseline), baseline }), false);
});

test('REGRESSION: even a form that still holds the stale cached start is not saved unless the person changed it', () => {
  // a form hydrated before this fix, or one that was never refreshed after a completion
  const baseline = routineBaselineFromVehicle(completedVehicle);
  const staleForm = formFor(baseline, { routineServiceStartingOdometerKm: '5000' });
  assert.equal(shouldSaveRoutineService({ form: staleForm, baseline }), true, 'a differing value IS a change the person must have made');
  // ...which is why the form is hydrated from the schedule in the first place:
  const hydrated = formFor(baseline);
  assert.equal(hydrated.routineServiceStartingOdometerKm, '10500');
});

test('changing the interval or the starting odometer is saved', () => {
  const baseline = routineBaselineFromVehicle(completedVehicle);
  assert.equal(shouldSaveRoutineService({ form: formFor(baseline, { routineServiceIntervalKm: '7500' }), baseline }), true);
  assert.equal(shouldSaveRoutineService({ form: formFor(baseline, { routineServiceStartingOdometerKm: '10000' }), baseline }), true);
});

test('creating a Routine Service (no schedule yet) always goes through to validation and save', () => {
  const baseline = routineBaselineFromVehicle({ routineService: null, fleetConfig: null });
  assert.equal(shouldSaveRoutineService({ form: { routineServiceIntervalKm: '5000', routineServiceStartingOdometerKm: '' }, baseline }), true);
  assert.equal(shouldSaveRoutineService({ form: { routineServiceIntervalKm: '5000', routineServiceStartingOdometerKm: '120000' }, baseline }), true);
});

test('an existing schedule whose start is unknown is left alone until the person enters one', () => {
  const baseline = routineBaselineFromVehicle({ routineService: { startingOdometerKm: null, intervalKm: 5000 }, fleetConfig: null });
  assert.equal(shouldSaveRoutineService({ form: formFor(baseline), baseline }), false);
  assert.equal(shouldSaveRoutineService({ form: formFor(baseline, { routineServiceStartingOdometerKm: '10500' }), baseline }), true);
});
