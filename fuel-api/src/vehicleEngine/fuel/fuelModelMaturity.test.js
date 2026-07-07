import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveModelMaturity, MATURITY_STATES } from './fuelModelMaturity.js';

const baseParams = {
  coldStartMaxObs: 0,
  learningMaxObs: 2,
  stabilizingMinObs: 3,
  matureMinObs: 5,
  matureMinConfidence: 60,
  shiftSuspectQuarantineCount: 2,
  recalibratingAcceptedInBandCount: 3,
};

test('deriveModelMaturity returns COLD_START with zero observations', () => {
  const r = deriveModelMaturity({ learningState: { totalObservations: 0 }, params: baseParams });
  assert.equal(r.state, MATURITY_STATES.COLD_START);
});

test('deriveModelMaturity progresses LEARNING → STABILIZING → MATURE', () => {
  const learning = deriveModelMaturity({
    learningState: { totalObservations: 1, confidence: 12, efficiencyHistory: [8] },
    params: baseParams,
  });
  assert.equal(learning.state, MATURITY_STATES.LEARNING);

  const stabilizing = deriveModelMaturity({
    learningState: { totalObservations: 3, confidence: 46, efficiencyHistory: [8, 8.1, 8.2] },
    params: baseParams,
  });
  assert.equal(stabilizing.state, MATURITY_STATES.STABILIZING);

  const mature = deriveModelMaturity({
    learningState: {
      totalObservations: 6,
      confidence: 82,
      efficiencyHistory: [8, 8.1, 8.2, 8.0, 8.1, 8.2],
    },
    params: baseParams,
  });
  assert.equal(mature.state, MATURITY_STATES.MATURE);
});

test('deriveModelMaturity returns SHIFT_SUSPECTED on consecutive quarantined', () => {
  const r = deriveModelMaturity({
    learningState: { totalObservations: 6, confidence: 80, efficiencyHistory: [8, 8, 8] },
    recentIntervals: [
      { quarantined: true, efficiencyKmL: 3.2 },
      { envelopeRejected: true, efficiencyKmL: 3.3 },
    ],
    params: baseParams,
  });
  assert.equal(r.state, MATURITY_STATES.SHIFT_SUSPECTED);
});

test('deriveModelMaturity returns RECALIBRATING after accepted in-band streak', () => {
  const envelope = { available: true, lowerBound: 3.0, upperBound: 4.0 };
  const r = deriveModelMaturity({
    learningState: { totalObservations: 8, confidence: 90, efficiencyHistory: [8, 8, 8] },
    recentIntervals: [
      { accepted: true, efficiencyKmL: 3.4 },
      { accepted: true, efficiencyKmL: 3.5 },
      { accepted: true, efficiencyKmL: 3.3 },
    ],
    envelope,
    params: baseParams,
  });
  assert.equal(r.state, MATURITY_STATES.RECALIBRATING);
});

test('all cutoffs respect injected params', () => {
  const custom = { ...baseParams, matureMinObs: 20 };
  const r = deriveModelMaturity({
    learningState: { totalObservations: 10, confidence: 90, efficiencyHistory: Array(10).fill(8) },
    params: custom,
  });
  assert.equal(r.state, MATURITY_STATES.STABILIZING);
});
