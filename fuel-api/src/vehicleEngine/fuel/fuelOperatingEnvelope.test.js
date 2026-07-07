import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOperatingEnvelope, classifyObservation } from './fuelOperatingEnvelope.js';

test('computeOperatingEnvelope returns no_envelope when below minSamples', () => {
  const env = computeOperatingEnvelope([8.0, 8.1], { minSamples: 3 });
  assert.equal(env.available, false);
  assert.equal(env.sampleSize, 2);
});

test('computeOperatingEnvelope median_mad produces bounds', () => {
  const env = computeOperatingEnvelope([8.0, 8.1, 8.2, 8.0], {
    method: 'median_mad',
    madMultiplier: 3,
    minSamples: 3,
  });
  assert.equal(env.available, true);
  assert.equal(env.method, 'median_mad');
  assert.ok(env.center >= 8.0 && env.center <= 8.2);
  assert.ok(env.lowerBound < env.center);
  assert.ok(env.upperBound > env.center);
});

test('classifyObservation flags value outside median_mad envelope', () => {
  const env = computeOperatingEnvelope([8.0, 8.1, 8.2], {
    madMultiplier: 1.5,
    minSamples: 3,
  });
  assert.equal(classifyObservation(8.05, env), 'normal');
  assert.equal(classifyObservation(3.2, env), 'outlier');
});

test('identical history mad=0 still produces bounds at center', () => {
  const env = computeOperatingEnvelope([8.0, 8.0, 8.0], { madMultiplier: 3, minSamples: 3 });
  assert.equal(env.available, true);
  assert.equal(env.spread, 0);
  assert.equal(env.lowerBound, env.upperBound);
  assert.equal(classifyObservation(3.2, env), 'outlier');
});

test('computeOperatingEnvelope iqr method', () => {
  const env = computeOperatingEnvelope([5, 8, 8.1, 8.2, 12], {
    method: 'iqr',
    iqrMultiplier: 1.5,
    minSamples: 3,
  });
  assert.equal(env.method, 'iqr');
  assert.equal(env.available, true);
  assert.equal(classifyObservation(8.1, env), 'normal');
});

test('classifyObservation returns no_envelope when envelope unavailable', () => {
  const env = computeOperatingEnvelope([], { minSamples: 3 });
  assert.equal(classifyObservation(8.0, env), 'no_envelope');
});
