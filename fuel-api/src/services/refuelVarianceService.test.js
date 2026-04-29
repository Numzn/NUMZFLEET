import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVariance } from './refuelVarianceService.js';

test('computeVariance returns normal below 5 percent', () => {
  const result = computeVariance(95, 100);
  assert.equal(result.status, 'warning');
  assert.equal(result.variancePercent, -5);
});

test('computeVariance returns flagged above 10 percent', () => {
  const result = computeVariance(122, 100);
  assert.equal(result.status, 'flagged');
  assert.equal(result.variancePercent, 22);
});

test('computeVariance handles zero estimated litres safely', () => {
  const result = computeVariance(20, 0);
  assert.equal(result.status, 'normal');
  assert.equal(result.variancePercent, null);
});
