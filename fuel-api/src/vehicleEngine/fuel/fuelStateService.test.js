import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isReliableFuelStateAnchor,
  sortRefuelsDeterministically,
  replayFuelState,
  deriveProjectionQuality,
  projectFuelState,
  buildEvidenceObservation,
  PROJECTION_QUALITY,
  PARTIAL_EVENT_POLICY,
} from './fuelStateService.js';

const refuel = (overrides = {}) => ({
  id: 1,
  actualFuelLitres: 60,
  currentMileage: 10000,
  capturedAt: '2026-07-01T08:00:00.000Z',
  sessionDate: '2026-07-01T00:00:00.000Z',
  isFullTank: true,
  fillClassification: 'FULL',
  tankCapacitySnapshot: 100,
  odometerConfidenceAtCapture: 'high',
  ...overrides,
});

const specEfficiencyResult = { efficiencyKmL: 10, efficiencySource: 'spec', confidence: null };

const mockDeps = (rows, {
  odometerKm = 10300,
  odometerConfidence = 'high',
  spec = null,
  efficiency = specEfficiencyResult,
} = {}) => ({
  loadRefuels: async () => rows,
  resolveOdometer: async () => ({ odometerKm, odometerConfidence }),
  loadSpec: async () => spec,
  resolveEfficiency: () => efficiency,
});

const hasCode = (diagnostics, code) => diagnostics.some((d) => d.code === code);

test('isReliableFuelStateAnchor accepts a confirmed full tank with usable capture', () => {
  assert.equal(isReliableFuelStateAnchor(refuel()), true);
  assert.equal(isReliableFuelStateAnchor(refuel({ odometerConfidenceAtCapture: 'medium' })), true);
});

test('isReliableFuelStateAnchor rejects each failing requirement individually', () => {
  assert.equal(isReliableFuelStateAnchor(null), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ fillClassification: 'PARTIAL', isFullTank: false })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ fillClassification: 'UNKNOWN', isFullTank: false })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ fillClassification: 'UNKNOWN', isFullTank: null })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ actualFuelLitres: 0 })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ actualFuelLitres: null })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ currentMileage: null })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ currentMileage: 0 })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ odometerConfidenceAtCapture: 'low' })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ odometerConfidenceAtCapture: 'unavailable' })), false);
  assert.equal(isReliableFuelStateAnchor(refuel({ odometerConfidenceAtCapture: null })), false);
});

test('isReliableFuelStateAnchor accepts legacy confirmed full with UNKNOWN classification', () => {
  assert.equal(isReliableFuelStateAnchor(refuel({
    fillClassification: 'UNKNOWN',
    isFullTank: true,
  })), true);
});

test('sortRefuelsDeterministically prefers capturedAt, falls back to sessionDate, breaks ties by id', () => {
  const a = refuel({ id: 3, capturedAt: '2026-07-01T09:00:00.000Z' });
  const b = refuel({ id: 2, capturedAt: null, sessionDate: '2026-07-01T10:00:00.000Z' });
  const c = refuel({ id: 1, capturedAt: '2026-07-01T09:00:00.000Z' });
  const sorted = sortRefuelsDeterministically([a, b, c]);
  assert.deepEqual(sorted.map((r) => r.id), [1, 3, 2]);
});

test('replay: full anchor with no movement returns full capacity', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [],
    liveOdometerKm: 10000,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, true);
  assert.equal(result.modelledLitresRemaining, 100);
  assert.equal(result.distanceSinceAnchorKm, 0);
});

test('replay: anchor then driving depletes by distance over efficiency', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [],
    liveOdometerKm: 10300,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, true);
  assert.equal(result.modelledLitresRemaining, 70);
  assert.equal(result.consumedLitresEstimate, 30);
});

test('replay: full → drive → partial → drive preserves event order', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [refuel({
      id: 2,
      fillClassification: 'PARTIAL',
      isFullTank: false,
      actualFuelLitres: 15,
      currentMileage: 10200,
      capturedAt: '2026-07-02T08:00:00.000Z',
    })],
    liveOdometerKm: 10500,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, true);
  assert.equal(result.modelledLitresRemaining, 65);
  assert.equal(result.partialLitresAdded, 15);
  assert.equal(result.replayedRefuelCount, 1);
});

test('replay: multiple partial refuels accumulate in order', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [
      refuel({ id: 2, fillClassification: 'PARTIAL', isFullTank: false, actualFuelLitres: 10, currentMileage: 10200 }),
      refuel({ id: 3, fillClassification: 'PARTIAL', isFullTank: false, actualFuelLitres: 12, currentMileage: 10400 }),
    ],
    liveOdometerKm: 10600,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, true);
  assert.equal(result.partialLitresAdded, 22);
  assert.equal(result.modelledLitresRemaining, 62);
});

test('replay: later confirmed full tank recalibrates balance and records calibration', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [refuel({
      id: 2, isFullTank: true, actualFuelLitres: 35, currentMileage: 10300,
    })],
    liveOdometerKm: 10500,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, true);
  assert.equal(result.fullRecalibrationCount, 1);
  assert.equal(result.modelledLitresRemaining, 80);
  assert.equal(result.calibrationOpportunities.length, 1);
  const cal = result.calibrationOpportunities[0];
  assert.equal(cal.predictedBalanceBeforeFill, 70);
  assert.equal(cal.predictedLitresNeededToFull, 30);
  assert.equal(cal.actualFuelLitres, 35);
  assert.equal(cal.calibrationErrorLitres, -5);
});

test('replay: calibration error compares predicted fill vs actual fill', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [refuel({
      id: 2, isFullTank: true, actualFuelLitres: 68, currentMileage: 10700,
    })],
    liveOdometerKm: 10700,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  const cal = result.calibrationOpportunities[0];
  assert.equal(cal.predictedLitresNeededToFull, 70);
  assert.equal(cal.calibrationErrorLitres, 2);
});

test('replay: ambiguous fill state halts on UNKNOWN classification', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [refuel({
      id: 2,
      fillClassification: 'UNKNOWN',
      isFullTank: false,
      actualFuelLitres: 25,
      currentMileage: 10200,
    })],
    liveOdometerKm: 10300,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, false);
  assert.equal(result.haltReason, 'unknown_fill_after_anchor');
  assert.equal(result.unknownFillCount, 1);
  assert.ok(hasCode(result.diagnostics, 'unknown_fill_classification'));
});

test('replay: historical false without classification is not replayed as trusted partial', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [refuel({ id: 2, fillClassification: 'UNKNOWN', isFullTank: false, actualFuelLitres: 20, currentMileage: 10200 })],
    liveOdometerKm: 10500,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, false);
  assert.equal(result.partialLitresAdded, 0);
});

test('replay: event with missing mileage halts as ambiguous replay boundary', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [refuel({ id: 2, isFullTank: false, actualFuelLitres: 20, currentMileage: null })],
    liveOdometerKm: 10500,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, false);
  assert.equal(result.haltReason, 'ambiguous_replay_boundary');
});

test('replay: backwards event odometer halts without silent correction', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [refuel({ id: 2, isFullTank: false, actualFuelLitres: 20, currentMileage: 9900 })],
    liveOdometerKm: 10500,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, false);
  assert.equal(result.haltReason, 'odometer_backwards');
});

test('replay: backwards live odometer halts', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [],
    liveOdometerKm: 9800,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, false);
  assert.equal(result.haltReason, 'odometer_backwards');
});

test('replay: missing live odometer halts', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [],
    liveOdometerKm: null,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, false);
  assert.equal(result.haltReason, 'live_odometer_unavailable');
});

test('replay: missing anchor mileage, capacity, or efficiency halt with exact reasons', () => {
  assert.equal(replayFuelState({
    anchor: refuel({ currentMileage: null }), events: [], liveOdometerKm: 10100, tankCapacityL: 100, efficiencyKmL: 10,
  }).haltReason, 'anchor_mileage_unavailable');
  assert.equal(replayFuelState({
    anchor: refuel(), events: [], liveOdometerKm: 10100, tankCapacityL: null, efficiencyKmL: 10,
  }).haltReason, 'tank_capacity_unavailable');
  assert.equal(replayFuelState({
    anchor: refuel(), events: [], liveOdometerKm: 10100, tankCapacityL: 100, efficiencyKmL: 0,
  }).haltReason, 'efficiency_unavailable');
});

test('replay: raw balance below zero is preserved in diagnostics then clamped', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [],
    liveOdometerKm: 12000,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, true);
  assert.equal(result.modelledLitresRemaining, 0);
  assert.equal(result.rawFinalBalance, -100);
  assert.equal(result.rawBelowZero, true);
  assert.ok(hasCode(result.diagnostics, 'raw_balance_below_zero'));
});

test('replay: partial overfilling above capacity is flagged then clamped', () => {
  const result = replayFuelState({
    anchor: refuel(),
    events: [refuel({
      id: 2,
      fillClassification: 'PARTIAL',
      isFullTank: false,
      actualFuelLitres: 40,
      currentMileage: 10100,
    })],
    liveOdometerKm: 10100,
    tankCapacityL: 100,
    efficiencyKmL: 10,
  });
  assert.equal(result.replayable, true);
  assert.equal(result.rawAboveCapacity, true);
  assert.equal(result.modelledLitresRemaining, 100);
  assert.ok(hasCode(result.diagnostics, 'raw_balance_above_capacity'));
});

test('quality: provenance mapping without numeric confidence', () => {
  assert.equal(deriveProjectionQuality({ efficiencySource: 'spec', modelMaturity: 'COLD_START' }), PROJECTION_QUALITY.LIMITED);
  assert.equal(deriveProjectionQuality({ efficiencySource: 'measured', modelMaturity: 'STABILIZING' }), PROJECTION_QUALITY.MODERATE);
  assert.equal(deriveProjectionQuality({ efficiencySource: 'learned', modelMaturity: 'MATURE' }), PROJECTION_QUALITY.STRONG);
  assert.equal(deriveProjectionQuality({ efficiencySource: 'learned', modelMaturity: 'RECALIBRATING' }), PROJECTION_QUALITY.STRONG);
  assert.equal(deriveProjectionQuality({ efficiencySource: 'learned', modelMaturity: 'SHIFT_SUSPECTED' }), PROJECTION_QUALITY.DEGRADED);
  assert.equal(deriveProjectionQuality({ efficiencySource: 'learned', modelMaturity: 'MATURE', liveOdometerConfidence: 'low' }), PROJECTION_QUALITY.DEGRADED);
  assert.equal(
    deriveProjectionQuality({ efficiencySource: 'learned', modelMaturity: 'MATURE', replay: { ambiguousEventCount: 1 } }),
    PROJECTION_QUALITY.DEGRADED,
  );
  assert.equal(
    deriveProjectionQuality({ efficiencySource: 'learned', modelMaturity: 'MATURE', replay: { rawBelowZero: true } }),
    PROJECTION_QUALITY.DEGRADED,
  );
});

test('project: no confirmed full anchor → unavailable', async () => {
  const rows = [
    refuel({ fillClassification: 'UNKNOWN', isFullTank: false }),
    refuel({ id: 2, fillClassification: 'PARTIAL', isFullTank: false }),
  ];
  const result = await projectFuelState({ deviceId: 7 }, mockDeps(rows));
  assert.equal(result.available, false);
  assert.equal(result.source, 'unavailable');
  assert.ok(hasCode(result.diagnostics, 'no_reliable_anchor'));
});

test('project: spec efficiency + COLD_START still projects in shadow mode with limited quality', async () => {
  const rows = [refuel()];
  const learning = { modelMaturity: 'COLD_START' };
  const result = await projectFuelState({ deviceId: 7, learning }, mockDeps(rows));
  assert.equal(result.available, true);
  assert.equal(result.source, 'model');
  assert.equal(result.projectionMode, 'shadow');
  assert.equal(result.projectionQuality, 'limited');
  assert.equal(result.modelledLitresRemaining, 70);
  assert.equal(result.estimatedSpaceLitres, 30);
  assert.equal(result.tankCapacitySource, 'anchor_snapshot');
  assert.equal(result.efficiencySource, 'spec');
  assert.equal(result.anchorRefuelId, 1);
  assert.equal(result.distanceSinceAnchorKm, 300);
});

test('project: post-anchor UNKNOWN legacy false fails closed', async () => {
  const rows = [
    refuel(),
    refuel({
      id: 2,
      fillClassification: 'UNKNOWN',
      isFullTank: false,
      actualFuelLitres: 20,
      currentMileage: 10200,
      capturedAt: '2026-07-02T08:00:00.000Z',
    }),
  ];
  const result = await projectFuelState({ deviceId: 7 }, mockDeps(rows));
  assert.equal(result.available, false);
  assert.ok(hasCode(result.diagnostics, 'replay_blocked_by_unknown_fill'));
  assert.equal(result.evidence.replayBlockedByUnknown, true);
});

test('project: post-anchor explicit PARTIAL replays successfully', async () => {
  const rows = [
    refuel(),
    refuel({
      id: 2,
      fillClassification: 'PARTIAL',
      isFullTank: false,
      actualFuelLitres: 15,
      currentMileage: 10200,
      capturedAt: '2026-07-02T08:00:00.000Z',
    }),
  ];
  const result = await projectFuelState({ deviceId: 7 }, mockDeps(rows, { odometerKm: 10500 }));
  assert.equal(result.available, true);
  assert.equal(result.partialLitresAdded, 15);
  assert.equal(result.evidence.trustedPartialCount, 1);
  assert.equal(result.evidence.replayBlockedByUnknown, false);
  assert.equal(PARTIAL_EVENT_POLICY, 'explicit');
});

test('project: FULL→drive→PARTIAL→drive→FULL calibration opportunity', async () => {
  const rows = [
    refuel(),
    refuel({
      id: 2,
      fillClassification: 'PARTIAL',
      isFullTank: false,
      actualFuelLitres: 10,
      currentMileage: 10200,
      capturedAt: '2026-07-02T08:00:00.000Z',
    }),
    refuel({
      id: 3,
      fillClassification: 'FULL',
      isFullTank: true,
      actualFuelLitres: 68,
      currentMileage: 10700,
      capturedAt: '2026-07-03T08:00:00.000Z',
      odometerConfidenceAtCapture: 'low',
    }),
  ];
  const result = await projectFuelState({ deviceId: 7 }, mockDeps(rows, { odometerKm: 10700 }));
  assert.equal(result.available, true);
  assert.equal(result.calibrationOpportunities.length, 1);
  assert.equal(result.calibrationOpportunities[0].fillClassification, 'FULL');
});

test('buildEvidenceObservation exposes anchor provenance', () => {
  const explicit = buildEvidenceObservation({
    anchor: refuel({ fillClassification: 'FULL' }),
    postAnchorEvents: [],
  });
  assert.equal(explicit.anchorClassification, 'FULL');
  assert.equal(explicit.anchorClassificationSource, 'explicit_classification');

  const legacy = buildEvidenceObservation({
    anchor: refuel({ fillClassification: 'UNKNOWN', isFullTank: true }),
    postAnchorEvents: [],
  });
  assert.equal(legacy.anchorClassificationSource, 'legacy_confirmed_full');
});

test('project: post-anchor full event with missing mileage halts replay', async () => {
  const rows = [
    refuel(),
    refuel({
      id: 2,
      fillClassification: 'FULL',
      isFullTank: true,
      currentMileage: null,
      capturedAt: '2026-07-02T08:00:00.000Z',
    }),
  ];
  const result = await projectFuelState({ deviceId: 7 }, mockDeps(rows));
  assert.equal(result.available, false);
  assert.ok(hasCode(result.diagnostics, 'ambiguous_replay_boundary'));
});

test('project: efficiency source none → unavailable', async () => {
  const result = await projectFuelState({ deviceId: 7 }, mockDeps([refuel()], {
    efficiency: { efficiencyKmL: null, efficiencySource: 'none', confidence: null },
  }));
  assert.equal(result.available, false);
  assert.ok(hasCode(result.diagnostics, 'efficiency_unavailable'));
});

test('project: tank capacity falls back to vehicle spec, else unavailable', async () => {
  const fromSpec = await projectFuelState({ deviceId: 7 }, mockDeps(
    [refuel({ tankCapacitySnapshot: null })],
    { spec: { tankCapacity: 80 } },
  ));
  assert.equal(fromSpec.available, true);
  assert.equal(fromSpec.tankCapacityLitres, 80);
  assert.equal(fromSpec.tankCapacitySource, 'vehicle_spec');

  const missing = await projectFuelState({ deviceId: 7 }, mockDeps(
    [refuel({ tankCapacitySnapshot: null })],
    { spec: null },
  ));
  assert.equal(missing.available, false);
  assert.ok(hasCode(missing.diagnostics, 'tank_capacity_unavailable'));
});

test('project: live odometer unavailable → unavailable', async () => {
  const result = await projectFuelState({ deviceId: 7 }, mockDeps([refuel()], { odometerKm: null }));
  assert.equal(result.available, false);
  assert.ok(hasCode(result.diagnostics, 'live_odometer_unavailable'));
});

test('project: backwards live odometer → unavailable with diagnostic', async () => {
  const result = await projectFuelState({ deviceId: 7 }, mockDeps([refuel()], { odometerKm: 9900 }));
  assert.equal(result.available, false);
  assert.ok(hasCode(result.diagnostics, 'odometer_backwards'));
});

test('project: newest reliable full tank wins under deterministic same-day ordering', async () => {
  const rows = [
    refuel({ id: 5, capturedAt: '2026-07-01T08:00:00.000Z', currentMileage: 10000 }),
    refuel({ id: 6, capturedAt: '2026-07-01T08:00:00.000Z', currentMileage: 10050 }),
  ];
  const result = await projectFuelState({ deviceId: 7 }, mockDeps(rows));
  assert.equal(result.available, true);
  assert.equal(result.anchorRefuelId, 6);
  assert.equal(result.anchorMileageKm, 10050);
});

test('project: missing device → unavailable', async () => {
  const result = await projectFuelState({ deviceId: null }, mockDeps([refuel()]));
  assert.equal(result.available, false);
  assert.ok(hasCode(result.diagnostics, 'device_unavailable'));
});
