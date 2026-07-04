import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOdometerKm } from './resolveOdometer.js';
import { rawTelemetryToKm, legacyAnchorTelemetryToKm, extractTelemetryEvidence } from './normaliseEvidence.js';
import { calculateDrift } from './calculateDrift.js';
import { scoreConfidence } from './scoreConfidence.js';
import { buildEvidenceFromBatch } from './collectEvidence.js';
import { resolveOdometerFromEvidence } from './resolveVehicleOdometer.js';
import { detectUnitMismatch } from './validateEvidence.js';

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

test('buildEvidenceFromBatch extracts full odometer>totalDistance>mileage priority from raw attrs', () => {
  const evidence = buildEvidenceFromBatch({
    deviceStatus: 'online',
    deviceLastUpdate: new Date().toISOString(),
    positionFixTime: new Date().toISOString(),
    positionAttributes: { odometer: 500, totalDistance: 480000 },
    verifiedOdometerKm: 490,
    verifiedOdometerAt: '2026-06-01T00:00:00.000Z',
    verifiedOdometerSource: 'manual',
    verifiedTraccarDistance: 475,
  });
  assert.equal(evidence.telemetryAttribute, 'odometer');
  assert.equal(evidence.telemetryKm, 500);
  assert.equal(evidence.anchor.anchorKm, 490);
  assert.equal(evidence.anchor.anchorTelemetryKm, 475);
  assert.equal(evidence.hasObservation, true);
});

test('buildEvidenceFromBatch with no spec anchor yields telemetry_only evidence', () => {
  const evidence = buildEvidenceFromBatch({
    deviceStatus: 'offline',
    deviceLastUpdate: '2026-06-06T23:28:15.000Z',
    positionFixTime: '2026-06-06T23:28:12.000Z',
    positionAttributes: { totalDistance: 1162082.5618777191 },
  });
  assert.equal(evidence.telemetryAttribute, 'totalDistance');
  assert.equal(evidence.telemetryKm, 1162.1);
  assert.equal(evidence.anchor, null);
  assert.equal(evidence.hasObservation, false);
});

test('rawTelemetryToKm no longer guesses odometer/mileage unit by magnitude', () => {
  // A genuine 500,001 km reading must not be treated as metres just because
  // it crosses the old (removed) 500,000 threshold.
  assert.equal(rawTelemetryToKm(500001, 'odometer'), 500001);
  assert.equal(rawTelemetryToKm(500001, 'mileage'), 500001);
  // totalDistance is unaffected — still unconditionally metres.
  assert.equal(rawTelemetryToKm(1162082.5618777191, 'totalDistance'), 1162.1);
});

test('detectUnitMismatch: consistent continuation is left untouched', () => {
  // Genuine 500,001 km reading, anchor shows a plausible recent continuation.
  const result = detectUnitMismatch('odometer', 500001, 499800);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.correctedKm, 500001);
});

test('detectUnitMismatch: ~1000x jump vs anchor is detected and corrected (metres mislabeled as km)', () => {
  const result = detectUnitMismatch('odometer', 1166000, 1162); // device sent metres under "odometer"
  assert.ok(result.diagnostics.includes('unit_mismatch_suspected'));
  assert.equal(result.correctedKm, 1166);
});

test('detectUnitMismatch: ~1000x drop vs anchor is detected and corrected (km divided upstream)', () => {
  const result = detectUnitMismatch('mileage', 1.166, 1162);
  assert.ok(result.diagnostics.includes('unit_mismatch_suspected'));
  assert.equal(result.correctedKm, 1166);
});

test('detectUnitMismatch: no anchor at all yields unit_unconfirmed, no guess applied', () => {
  const result = detectUnitMismatch('odometer', 500001, null);
  assert.ok(result.diagnostics.includes('unit_unconfirmed'));
  assert.equal(result.correctedKm, 500001); // unchanged — not divided, not guessed
});

test('detectUnitMismatch: totalDistance is never subject to unit-mismatch checks', () => {
  const result = detectUnitMismatch('totalDistance', 1162.1, 1166);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(result.correctedKm, 1162.1);
});

test('resolveOdometerFromEvidence: x1000 unit mismatch is corrected end-to-end and confidence is downgraded', () => {
  const evidence = buildEvidenceFromBatch({
    deviceStatus: 'online',
    deviceLastUpdate: new Date().toISOString(),
    positionFixTime: new Date().toISOString(),
    positionAttributes: { odometer: 1166000 }, // device sent metres under "odometer"
    verifiedOdometerKm: 1162,
    verifiedOdometerAt: new Date().toISOString(),
    verifiedOdometerSource: 'manual',
    verifiedTraccarDistance: 1166, // anchor's own telemetry baseline == corrected current value -> zero delta
  });
  const result = resolveOdometerFromEvidence(evidence);
  assert.equal(result.odometerKm, 1162); // anchor(1162) + max(0, corrected(1166) - anchorTelemetry(1166))
  assert.ok(result.diagnostics.includes('unit_mismatch_suspected'));
  assert.notEqual(result.odometerConfidence, 'high'); // downgraded, not silently trusted
});

test('resolveOdometerFromEvidence matches the real dev vehicle (TOYOTA ALLION, deviceId 4)', () => {
  // Live values pulled directly from the dev DB: tc_devices/tc_positions (deviceId 4)
  // and vehicle_specs (verifiedOdometerKm=1166, verifiedTraccarDistance=1162.1).
  const evidence = buildEvidenceFromBatch({
    deviceStatus: 'offline',
    deviceLastUpdate: '2026-06-06T23:28:15.000Z',
    positionFixTime: '2026-06-06T23:28:12.000Z',
    positionAttributes: { totalDistance: 1162082.5618777191 },
    verifiedOdometerKm: 1166,
    verifiedOdometerAt: '2026-07-02T06:54:13.588Z',
    verifiedOdometerSource: 'manual',
    verifiedTraccarDistance: 1162.1,
  });
  const result = resolveOdometerFromEvidence(evidence);
  assert.equal(result.odometerKm, 1166);
  assert.equal(result.resolutionMode, 'anchored');
  assert.ok(result.diagnostics.includes('stale_telemetry'));
});
