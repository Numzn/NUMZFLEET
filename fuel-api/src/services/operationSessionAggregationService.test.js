import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTotalsFromRefuels } from './operationSessionAggregationService.js';

test('summarizeTotalsFromRefuels computes estimated and actual totals', () => {
  const totals = summarizeTotalsFromRefuels([
    {
      estimatedFuelLitres: 30,
      actualFuelLitres: 28,
      estimatedCost: 900,
      actualCost: 840,
    },
    {
      estimatedFuelLitres: 20,
      fuelAmount: 19,
      estimatedCost: 600,
      fuelCost: 570,
    },
  ]);

  assert.equal(totals.totalEstimatedFuel, 50);
  assert.equal(totals.totalActualFuel, 47);
  assert.equal(totals.totalEstimatedCost, 1500);
  assert.equal(totals.totalActualCost, 1410);
});

test('summarizeTotalsFromRefuels prefers plannedFuelLitres for planned rollup', () => {
  const totals = summarizeTotalsFromRefuels([
    {
      plannedFuelLitres: 50,
      estimatedFuelLitres: 45,
      estimatedCost: 1500,
      actualFuelLitres: 48,
      actualCost: 1440,
    },
    {
      plannedFuelLitres: 70,
      estimatedFuelLitres: 60,
      estimatedCost: 2100,
      actualFuelLitres: null,
      actualCost: null,
    },
  ]);

  assert.equal(totals.totalEstimatedFuel, 120);
  assert.equal(totals.totalActualFuel, 48);
  assert.equal(totals.totalEstimatedCost, 3600);
});
