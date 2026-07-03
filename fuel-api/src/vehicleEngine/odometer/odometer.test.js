import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOdometerKm } from './resolveOdometer.js';
import { rawTelemetryToKm, legacyAnchorTelemetryToKm, extractTelemetryEvidence } from './normaliseEvidence.js';
import { calculateDrift } from './calculateDrift.js';
import { scoreConfidence } from './scoreConfidence.js';

test('resolveOdometerKm anchored adds telemetry delta', () => {
  const result = resolveOdometerKm({
    anchorKm: 100000,
    anchorTelemetryKm: 95000,
    currentTelemetryKm: 96500,
  });
  assert.equal(result.odometerKm, 101500);
  assert.equal(result.resolutionMode, 'anchored');
});

test('resolveOdometerKm clamps negative delta at anchor', () => {
  const result = resolveOdometerKm({
    anchorKm: 100000,
    anchorTelemetryKm: 95000,
    currentTelemetryKm: 90000,
  });
  assert.equal(result.odometerKm, 100000);
});

test('resolveOdometerKm telemetry-only', () => {
  const result = resolveOdometerKm({
    anchorKm: null,
    anchorTelemetryKm: null,
    currentTelemetryKm: 42,
  });
  assert.equal(result.odometerKm, 42);
  assert.equal(result.resolutionMode, 'telemetry_only');
});

test('rawTelemetryToKm converts totalDistance metres', () => {
  assert.equal(rawTelemetryToKm(221450000, 'totalDistance'), 221450);
});

test('extractTelemetryEvidence prefers odometer over totalDistance', () => {
  const { km, attribute } = extractTelemetryEvidence({
    odometer: 250,
    totalDistance: 190000,
  });
  assert.equal(attribute, 'odometer');
  assert.equal(km, 250);
});

test('calculateDrift uses latest observation', () => {
  const { driftPct, driftClass } = calculateDrift(100200, 100000);
  assert.ok(driftPct > 0.1 && driftPct <= 0.5);
  assert.equal(driftClass, 'normal');
});

test('calculateDrift null and unknown without observation', () => {
  const { driftPct, driftClass } = calculateDrift(100000, null);
  assert.equal(driftPct, null);
  assert.equal(driftClass, 'unknown');
});

test('scoreConfidence caps without observation', () => {
  const level = scoreConfidence({
    odometerKm: 100000,
    resolutionMode: 'telemetry_only',
    driftClass: 'unknown',
    diagnostics: [],
    hasObservation: false,
  });
  assert.equal(level, 'medium');
});

test('legacyAnchorTelemetryToKm treats large values as metres', () => {
  assert.equal(legacyAnchorTelemetryToKm(95000000), 95000);
});
