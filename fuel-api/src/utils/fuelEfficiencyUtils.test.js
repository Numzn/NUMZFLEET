import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTankToTankEfficiency } from './fuelEfficiencyUtils.js';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

test('calculateTankToTankEfficiency returns km/L from consecutive refuels', () => {
  const rows = [
    { actualFuelLitres: 40, currentMileage: 10000, sessionDate: daysAgo(20) },
    { actualFuelLitres: 50, currentMileage: 10500, sessionDate: daysAgo(10) },
  ];

  const result = calculateTankToTankEfficiency(rows, { windowDays: 30 });
  assert.equal(result.measured, true);
  assert.equal(result.intervalCount, 1);
  assert.equal(result.totalDistanceKm, 500);
  assert.equal(result.totalFuelLitres, 50);
  assert.equal(result.kmPerLitre, 10);
  assert.equal(result.lPer100km, 10);
});

test('calculateTankToTankEfficiency skips rows without paired mileage', () => {
  const rows = [
    { actualFuelLitres: 40, currentMileage: null, sessionDate: daysAgo(20) },
    { actualFuelLitres: 50, currentMileage: 10500, sessionDate: daysAgo(10) },
  ];

  const result = calculateTankToTankEfficiency(rows, { windowDays: 30 });
  assert.equal(result.measured, false);
  assert.equal(result.kmPerLitre, null);
});

test('calculateTankToTankEfficiency excludes refuels outside window', () => {
  const rows = [
    { actualFuelLitres: 40, currentMileage: 10000, sessionDate: daysAgo(60) },
    { actualFuelLitres: 50, currentMileage: 10500, sessionDate: daysAgo(45) },
  ];

  const result = calculateTankToTankEfficiency(rows, { windowDays: 30 });
  assert.equal(result.refuelCountInWindow, 0);
  assert.equal(result.measured, false);
});
