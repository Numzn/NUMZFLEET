import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyEvidence,
  gateEfficiencyObservation,
  EVIDENCE_CLASS,
} from './fuelEvidenceClassifier.js';
import { INTERVAL_STATUS } from './intervalValidator.js';

test('classifyEvidence returns REJECTED for rejected validation', () => {
  const r = classifyEvidence({
    validation: { status: INTERVAL_STATUS.REJECTED, reason: 'odometer_backwards' },
  });
  assert.equal(r.evidenceClass, EVIDENCE_CLASS.REJECTED);
  assert.equal(r.shouldLearn, false);
});

test('classifyEvidence returns QUARANTINED for STORED_ONLY', () => {
  const r = classifyEvidence({
    validation: { status: INTERVAL_STATUS.STORED_ONLY, reason: 'previous_partial_fill' },
  });
  assert.equal(r.evidenceClass, EVIDENCE_CLASS.QUARANTINED);
  assert.equal(r.shouldLearn, false);
});

test('classifyEvidence returns OUTLIER when gate flags anomaly', () => {
  const r = classifyEvidence({
    validation: { status: INTERVAL_STATUS.LEARNABLE, efficiencyKmL: 3.2 },
    gateResult: { isAnomalous: true, reason: 'envelope_outlier' },
  });
  assert.equal(r.evidenceClass, EVIDENCE_CLASS.OUTLIER);
  assert.equal(r.shouldLearn, false);
});

test('classifyEvidence returns NORMAL for learnable passing gate', () => {
  const r = classifyEvidence({
    validation: { status: INTERVAL_STATUS.LEARNABLE, efficiencyKmL: 8.1 },
    gateResult: { isAnomalous: false },
  });
  assert.equal(r.evidenceClass, EVIDENCE_CLASS.NORMAL);
  assert.equal(r.shouldLearn, true);
});

test('gateEfficiencyObservation uses envelope when history sufficient', () => {
  const history = [8.0, 8.1, 8.2];
  const gate = gateEfficiencyObservation(3.2, history, { enabled: true, madMultiplier: 3, minSamples: 3 });
  assert.equal(gate.isAnomalous, true);
  assert.equal(gate.gate, 'envelope');
});

test('gateEfficiencyObservation falls back to sigma when history insufficient', () => {
  const gate = gateEfficiencyObservation(8.0, [8.0], { enabled: true, minSamples: 3 });
  assert.equal(gate.gate, 'sigma');
  assert.equal(gate.isAnomalous, false);
});

test('gateEfficiencyObservation sigma zero-std hole passes outlier', () => {
  const gate = gateEfficiencyObservation(3.2, [8.0, 8.0, 8.0], { enabled: false });
  assert.equal(gate.gate, 'sigma');
  assert.equal(gate.isAnomalous, false);
});
