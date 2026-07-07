import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterval, INTERVAL_STATUS } from './intervalValidator.js';

const basePrev = {
  currentMileage: 10000,
  odometerConfidenceAtCapture: 'high',
  odometerDriftClassAtCapture: 'excellent',
  isFullTank: true,
  fillClassification: 'FULL',
};

const baseCur = {
  currentMileage: 10500,
  actualFuelLitres: 50,
  odometerConfidenceAtCapture: 'high',
  odometerDriftClassAtCapture: 'excellent',
  isFullTank: true,
  fillClassification: 'FULL',
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

test('validateInterval stores only explicit partial fill on current', () => {
  const r = validateInterval({
    previous: basePrev,
    current: { ...baseCur, fillClassification: 'PARTIAL', isFullTank: false },
  });
  assert.equal(r.status, INTERVAL_STATUS.STORED_ONLY);
  assert.equal(r.reason, 'partial_fill');
});

test('validateInterval stores only unclassified fill when legacy false without classification', () => {
  const r = validateInterval({
    previous: basePrev,
    current: { ...baseCur, fillClassification: 'UNKNOWN', isFullTank: false },
  });
  assert.equal(r.status, INTERVAL_STATUS.STORED_ONLY);
  assert.equal(r.reason, 'unclassified_fill');
});

test('validateInterval stores only when previous was explicit partial fill', () => {
  const r = validateInterval({
    previous: { ...basePrev, fillClassification: 'PARTIAL', isFullTank: false },
    current: baseCur,
  });
  assert.equal(r.status, INTERVAL_STATUS.STORED_ONLY);
  assert.equal(r.reason, 'previous_partial_fill');
});

test('validateInterval stores only when previous was unclassified', () => {
  const r = validateInterval({
    previous: { ...basePrev, fillClassification: 'UNKNOWN', isFullTank: false },
    current: baseCur,
  });
  assert.equal(r.status, INTERVAL_STATUS.STORED_ONLY);
  assert.equal(r.reason, 'previous_unclassified_fill');
});

test('validateInterval accepts legacy confirmed full previous with UNKNOWN classification', () => {
  const r = validateInterval({
    previous: { ...basePrev, fillClassification: 'UNKNOWN', isFullTank: true },
    current: baseCur,
  });
  assert.equal(r.status, INTERVAL_STATUS.LEARNABLE);
});
