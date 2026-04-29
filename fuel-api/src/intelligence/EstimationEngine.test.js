import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateFuelLitres, estimatedLitresToFill } from './EstimationEngine.js';

test('estimated litres = capacity - capacity*level (fraction full)', () => {
  assert.equal(estimateFuelLitres({ tankCapacity: 100, tankLevelFraction: 0.25 }), 75);
  assert.equal(estimatedLitresToFill({ tankCapacityLitres: 80, tankLevelFraction: 0.5 }), 40);
});

test('percent 0-100 normalized', () => {
  assert.equal(estimateFuelLitres({ tankCapacity: 100, tankLevelFraction: 50 }), 50);
});
