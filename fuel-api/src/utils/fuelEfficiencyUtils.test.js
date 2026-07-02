import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTankToTankEfficiency } from './fuelEfficiencyUtils.js';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const learnableRow = (mileage, litres, days) => ({
  actualFuelLitres: litres,
  currentMileage: mileage,
  sessionDate: daysAgo(days),
  odometerConfidenceAtCapture: 'high',
  odometerDriftClassAtCapture: 'excellent',
  isFullTank: true,
});

test('calculateTankToTankEfficiency returns km/L from consecutive learnable refuels', () => {
  const rows = [
    learnableRow(10000, 40, 20),
    learnableRow(10500, 50, 10),
  ];

  const result = calculateTankToTankEfficiency(rows, { windowDays: 30, tankCapacity: 60, specEfficiencyKmL: 10 });
  assert.equal(result.measured, true);
  assert.equal(result.learnableIntervalCount, 1);
  assert.equal(result.totalDistanceKm, 500);
  assert.equal(result.totalFuelLitres, 50);
  assert.equal(result.kmPerLitre, 10);
  assert.equal(result.lPer100km, 10);
});

test('calculateTankToTankEfficiency skips rows without paired mileage', () => {
  const rows = [
    { actualFuelLitres: 40, currentMileage: null, sessionDate: daysAgo(20) },
    learnableRow(10500, 50, 10),
  ];

  const result = calculateTankToTankEfficiency(rows, { windowDays: 30 });
  assert.equal(result.measured, false);
  assert.equal(result.kmPerLitre, null);
});

test('calculateTankToTankEfficiency excludes refuels outside window', () => {
  const rows = [
    learnableRow(10000, 40, 60),
    learnableRow(10500, 50, 45),
  ];

  const result = calculateTankToTankEfficiency(rows, { windowDays: 30 });
  assert.equal(result.refuelCountInWindow, 0);
  assert.equal(result.measured, false);
});

test('calculateTankToTankEfficiency stores only short distance intervals', () => {
  const rows = [
    learnableRow(10000, 40, 20),
    learnableRow(10005, 50, 10),
  ];
  const result = calculateTankToTankEfficiency(rows, { windowDays: 30 });
  assert.equal(result.learnableIntervalCount, 0);
  assert.equal(result.storedIntervalCount, 1);
  assert.equal(result.measured, false);
});
