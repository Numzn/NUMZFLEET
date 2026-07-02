import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterval, INTERVAL_STATUS } from './intervalValidator.js';

const basePrev = {
  currentMileage: 10000,
  odometerConfidenceAtCapture: 'high',
  odometerDriftClassAtCapture: 'excellent',
  isFullTank: true,
};

const baseCur = {
  currentMileage: 10500,
  actualFuelLitres: 50,
  odometerConfidenceAtCapture: 'high',
  odometerDriftClassAtCapture: 'excellent',
  isFullTank: true,
};

test('validateInterval accepts learnable interval', () => {
  const r = validateInterval({ previous: basePrev, current: baseCur, tankCapacity: 60, specEfficiencyKmL: 10 });
  assert.equal(r.status, INTERVAL_STATUS.LEARNABLE);
  assert.equal(r.distanceKm, 500);
  assert.equal(r.efficiencyKmL, 10);
});

test('validateInterval rejects short distance', () => {
  const r = validateInterval({
    previous: basePrev,
    current: { ...baseCur, currentMileage: 10005 },
  });
  assert.equal(r.status, INTERVAL_STATUS.STORED_ONLY);
  assert.equal(r.reason, 'distance_too_short');
});

test('validateInterval rejects low odometer confidence', () => {
  const r = validateInterval({
    previous: basePrev,
    current: { ...baseCur, odometerConfidenceAtCapture: 'low' },
  });
  assert.equal(r.status, INTERVAL_STATUS.STORED_ONLY);
  assert.equal(r.reason, 'low_odometer_confidence');
});

test('validateInterval stores only partial fill', () => {
  const r = validateInterval({
    previous: basePrev,
    current: { ...baseCur, isFullTank: false },
  });
  assert.equal(r.status, INTERVAL_STATUS.STORED_ONLY);
  assert.equal(r.reason, 'partial_fill');
});
