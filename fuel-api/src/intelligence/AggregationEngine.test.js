import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeByFuelType } from './AggregationEngine.js';

test('summarizeByFuelType splits planned/actual/cost by fuel type', () => {
  const result = summarizeByFuelType([
    { fuelTypeSnapshot: 'diesel', plannedFuelLitres: 100, actualFuelLitres: 90, actualCost: 1800 },
    { fuelTypeSnapshot: 'petrol', plannedFuelLitres: 40, actualFuelLitres: 45, actualCost: 1125 },
    { fuelTypeSnapshot: 'diesel', plannedFuelLitres: 50, actualFuelLitres: 50, actualCost: 1000 },
  ]);

  assert.equal(result.diesel.plannedL, 150);
  assert.equal(result.diesel.actualL, 140);
  assert.equal(result.diesel.cost, 2800);
  assert.equal(result.petrol.plannedL, 40);
  assert.equal(result.petrol.actualL, 45);
  assert.equal(result.petrol.cost, 1125);
});

test('summarizeByFuelType treats missing fuel type as diesel', () => {
  const result = summarizeByFuelType([
    { plannedFuelLitres: 30, actualFuelLitres: 30, fuelCost: 600 },
  ]);

  assert.equal(result.diesel.actualL, 30);
  assert.equal(result.diesel.cost, 600);
  assert.equal(result.petrol.actualL, 0);
});

test('summarizeByFuelType falls back to estimated litres when planned missing', () => {
  const result = summarizeByFuelType([
    { fuelTypeSnapshot: 'diesel', estimatedFuelLitres: 70 },
  ]);

  assert.equal(result.diesel.plannedL, 70);
  assert.equal(result.diesel.actualL, 0);
});
