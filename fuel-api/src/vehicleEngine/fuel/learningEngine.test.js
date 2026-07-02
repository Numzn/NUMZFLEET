import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLearningUpdate, adaptiveAlpha } from './learningEngine.js';

test('applyLearningUpdate initializes efficiency on first observation', () => {
  const next = applyLearningUpdate(null, 10, { distanceKm: 500 });
  assert.equal(next.currentEfficiency, 10);
  assert.equal(next.totalObservations, 1);
  assert.equal(next.efficiencyHistory.length, 1);
});

test('applyLearningUpdate applies EWMA on subsequent observations', () => {
  const first = applyLearningUpdate(null, 10, { distanceKm: 500 });
  const second = applyLearningUpdate(first, 8, { distanceKm: 400 });
  assert.ok(second.currentEfficiency < 10);
  assert.ok(second.currentEfficiency > 8);
  assert.equal(second.totalObservations, 2);
});

test('adaptiveAlpha increases when confidence is low', () => {
  assert.equal(adaptiveAlpha({ confidence: 30, trend: 'stable' }), 0.35);
  assert.equal(adaptiveAlpha({ confidence: 90, trend: 'stable' }), 0.15);
  assert.equal(adaptiveAlpha({ confidence: 90, trend: 'declining' }), 0.4);
});
