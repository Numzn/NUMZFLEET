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
