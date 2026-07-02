import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistry } from '../registryBuilder.js';
import { formatOdometerResponse } from './formatOdometerResponse.js';
import { resolveOdometerKm } from './resolveOdometer.js';
import { calculateDrift } from './calculateDrift.js';
import { scoreConfidence } from './scoreConfidence.js';
import { toRefuelDto } from '../../services/operationSessionCore.js';
import { buildPrefillRefuelRow } from '../../intelligence/RefuelEngine.js';

test('formatOdometerResponse matches buildRegistry odometer fields', () => {
  const state = {
    odometerKm: 100000,
    odometerConfidence: 'high',
    odometerDriftPct: 0.05,
    odometerDriftClass: 'excellent',
  };
  const registry = buildRegistry({ id: 'veh-1' }, state);
  const api = formatOdometerResponse(state);

  assert.equal(registry.odometerKm, api.odometerKm);
  assert.equal(registry.odometerConfidence, api.odometerConfidence);
  assert.equal(registry.odometerDriftPct, api.odometerDriftPct);
  assert.equal(registry.odometerDriftClass, api.odometerDriftClass);
});

test('formatOdometerResponse defaults drift to null and unknown', () => {
  const api = formatOdometerResponse({
    odometerKm: 50000,
    odometerConfidence: 'medium',
    resolutionMode: 'telemetry_only',
  });
  assert.equal(api.odometerDriftPct, null);
  assert.equal(api.odometerDriftClass, 'unknown');
});

test('anchored mode resolves odometer from observation and telemetry delta', () => {
  const { odometerKm, resolutionMode } = resolveOdometerKm({
    anchorKm: 100000,
    anchorTelemetryKm: 95000,
    currentTelemetryKm: 96500,
  });
  assert.equal(odometerKm, 101500);
  assert.equal(resolutionMode, 'anchored');
});

test('telemetry-only mode without observation anchor', () => {
  const { odometerKm, resolutionMode } = resolveOdometerKm({
    anchorKm: null,
    anchorTelemetryKm: null,
    currentTelemetryKm: 42000,
  });
  assert.equal(odometerKm, 42000);
  assert.equal(resolutionMode, 'telemetry_only');
});

test('no evidence yields unavailable odometer', () => {
  const { odometerKm, resolutionMode } = resolveOdometerKm({
    anchorKm: null,
    anchorTelemetryKm: null,
    currentTelemetryKm: null,
  });
  assert.equal(odometerKm, null);
  assert.equal(resolutionMode, 'unavailable');

  const registry = buildRegistry({ id: 'veh-1' }, {
    odometerKm: null,
    odometerConfidence: 'unavailable',
    odometerDriftPct: null,
    odometerDriftClass: 'unknown',
  });
  assert.equal(registry.odometerKm, null);
  assert.equal(registry.odometerConfidence, 'unavailable');
});

test('observation update enables drift calculation and raises confidence ceiling', () => {
  const observationKm = 100000;
  const { odometerKm } = resolveOdometerKm({
    anchorKm: observationKm,
    anchorTelemetryKm: 95000,
    currentTelemetryKm: 95200,
  });
  const { driftPct, driftClass } = calculateDrift(odometerKm, observationKm);
  assert.ok(driftPct != null);
  assert.notEqual(driftClass, 'unknown');

  const withObservation = scoreConfidence({
    odometerKm,
    resolutionMode: 'anchored',
    driftClass,
    diagnostics: [],
    hasObservation: true,
  });
  const withoutObservation = scoreConfidence({
    odometerKm,
    resolutionMode: 'telemetry_only',
    driftClass: 'unknown',
    diagnostics: [],
    hasObservation: false,
  });
  assert.equal(withoutObservation, 'medium');
  assert.equal(withObservation, 'high');
});

test('fuel prefill snapshot row stores mileage without observation semantics', () => {
  const row = buildPrefillRefuelRow({
    sessionId: 1,
    userId: 2,
    vehicleId: 99,
    tankCapacity: 60,
    tankLevelFraction: 0.5,
    telemetryMileage: 221450,
    pricePerLitre: 25,
    sessionDate: new Date('2026-06-01'),
    plannedFuelLitres: 40,
    fuelTypeSnapshot: 'diesel',
  });
  assert.equal(row.currentMileage, 221450);
  assert.equal(row.mileageSource, 'snapshot');
  assert.ok(!('verifiedOdometerKm' in row));
});

test('toRefuelDto attaches live odometer from engine state', () => {
  const dto = toRefuelDto({
    id: 1,
    sessionId: 10,
    userId: 2,
    vehicleId: 42,
    fuelCost: 0,
    fuelAmount: 0,
    currentMileage: 220000,
    mileageSource: 'snapshot',
  }, {
    odometerKm: 221450,
    odometerConfidence: 'high',
    odometerDriftPct: 0.02,
    odometerDriftClass: 'excellent',
  });

  assert.equal(dto.odometerKm, 221450);
  assert.equal(dto.odometerConfidence, 'high');
  assert.equal(dto.currentMileage, 220000);
});

test('drift bands classify observation_recommended above 1%', () => {
  const { driftClass } = calculateDrift(101500, 100000);
  assert.equal(driftClass, 'observation_recommended');
});
