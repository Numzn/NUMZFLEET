import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFuelLevelFromAttrs, normalizeFuelLevelValue } from './normalizeFuelLevel.js';

test('normalizeFuelLevelFromAttrs accepts fraction', () => {
  assert.equal(normalizeFuelLevelFromAttrs({ fuel: 0.52 }), 52);
  assert.equal(normalizeFuelLevelFromAttrs({ fuel_level: 0.75 }), 75);
});

test('normalizeFuelLevelFromAttrs accepts percent', () => {
  assert.equal(normalizeFuelLevelFromAttrs({ fuelLevel: 45 }), 45);
  assert.equal(normalizeFuelLevelFromAttrs({ fuel1: 100 }), 100);
});

test('normalizeFuelLevelFromAttrs returns null for missing or invalid', () => {
  assert.equal(normalizeFuelLevelFromAttrs(null), null);
  assert.equal(normalizeFuelLevelFromAttrs({}), null);
  assert.equal(normalizeFuelLevelFromAttrs({ fuel: 150 }), null);
});

test('normalizeFuelLevelValue mirrors fraction and percent', () => {
  assert.equal(normalizeFuelLevelValue(0.25), 25);
  assert.equal(normalizeFuelLevelValue(80), 80);
  assert.equal(normalizeFuelLevelValue(0), 0);
});
