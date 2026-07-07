import test from 'node:test';
import assert from 'node:assert/strict';
import { detectEfficiencyAnomaly } from './anomalyDetector.js';
import { applyLearningUpdate, adaptiveAlpha } from './learningEngine.js';
import { computeOperatingEnvelope, classifyObservation } from './fuelOperatingEnvelope.js';

test('audit: observations 1-3 pass 3σ (insufficient history)', () => {
  assert.equal(detectEfficiencyAnomaly(3.2, [8.0]).isAnomalous, false);
  assert.equal(detectEfficiencyAnomaly(3.2, [8.0, 8.1]).isAnomalous, false);
});

test('audit: σ=0 hole — identical history accepts any value via 3σ', () => {
  const history = [8.0, 8.0, 8.0];
  assert.equal(detectEfficiencyAnomaly(3.2, history).isAnomalous, false);
});

test('audit: small-sample 3σ — noisy history lets 3.2 km/L pass', () => {
  const history = [5, 12, 8];
  assert.equal(detectEfficiencyAnomaly(3.2, history).isAnomalous, false);
});

test('audit: median/MAD envelope quarantines 3.2 with tight history', () => {
  const env = computeOperatingEnvelope([8.0, 8.0, 8.0], { madMultiplier: 3, minSamples: 3 });
  assert.equal(classifyObservation(3.2, env), 'outlier');
});

test('audit: single accepted outlier displaces baseline ~18% at alpha 0.3', () => {
  const alpha = adaptiveAlpha({ confidence: 55, trend: 'stable' });
  assert.equal(alpha, 0.3);
  const state = {
    currentEfficiency: 8.0,
    confidence: 55,
    trend: 'stable',
    totalObservations: 3,
    totalDistanceKm: 1000,
    efficiencyHistory: [8.0, 8.0, 8.0],
  };
  const updated = applyLearningUpdate(state, 3.2, { distanceKm: 100 });
  const displacementPct = Math.abs((updated.currentEfficiency - 8.0) / 8.0) * 100;
  assert.ok(displacementPct > 15 && displacementPct < 20, `displacement=${displacementPct}`);
  assert.equal(Number(updated.currentEfficiency.toFixed(2)), 6.56);
});
