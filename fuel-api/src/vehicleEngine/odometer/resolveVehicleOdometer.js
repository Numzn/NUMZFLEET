import { collectEvidence } from './collectEvidence.js';
import { resolveOdometerKm } from './resolveOdometer.js';
import {
  validateTelemetryFreshness,
  detectResetSuspected,
  detectUnitMismatch,
} from './validateEvidence.js';
import { calculateDrift } from './calculateDrift.js';
import { scoreConfidence } from './scoreConfidence.js';

/**
 * Pure resolution core (M2 §3) — no I/O. Takes evidence already gathered
 * (either via collectEvidence's per-device fetch, or built synchronously
 * from an already-batch-loaded device/position/spec) and produces the one
 * canonical odometer result. This is the single mileage engine; every
 * caller (single-vehicle or batched) must resolve through this function.
 * @param {{ telemetryKm: number|null, telemetryAttribute: string|null, anchor: object|null, hasObservation: boolean, latestObservationKm: number|null, device: object|null, position: object|null }} evidence
 */
export function resolveOdometerFromEvidence(evidence) {
  const freshness = validateTelemetryFreshness({
    device: evidence.device,
    position: evidence.position,
  });

  // Unit-mismatch check runs before reset detection so both reset detection
  // and resolution compare against a km-scale value, not a possibly
  // mis-unit'd raw one.
  const unit = detectUnitMismatch(
    evidence.telemetryAttribute,
    evidence.telemetryKm,
    evidence.anchor?.anchorKm ?? null,
  );

  const reset = detectResetSuspected(
    evidence.anchor?.anchorTelemetryKm ?? null,
    unit.correctedKm,
  );

  const diagnostics = [
    ...freshness.diagnostics,
    ...reset.diagnostics,
    ...unit.diagnostics,
  ];

  const { odometerKm, resolutionMode } = resolveOdometerKm({
    anchorKm: evidence.anchor?.anchorKm ?? null,
    anchorTelemetryKm: evidence.anchor?.anchorTelemetryKm ?? null,
    currentTelemetryKm: unit.correctedKm,
  });

  const { driftPct, driftClass } = calculateDrift(
    odometerKm,
    evidence.latestObservationKm,
  );

  const confidence = scoreConfidence({
    odometerKm,
    resolutionMode,
    driftClass,
    diagnostics,
    hasObservation: evidence.hasObservation,
  });

  return {
    odometerKm,
    odometerConfidence: confidence,
    odometerDriftPct: driftPct,
    odometerDriftClass: driftClass,
    resolutionMode,
    diagnostics,
  };
}

/**
 * Vehicle Odometer Engine — single resolution cycle (M2 §3).
 * @param {{ merged: object, deviceId: number|null }}
 */
export async function resolveVehicleOdometer({ merged, deviceId }) {
  const evidence = await collectEvidence({ merged, deviceId });
  return resolveOdometerFromEvidence(evidence);
}

export default { resolveVehicleOdometer };

/**
 * Resolve odometer by Traccar device id (fuel prefill, maintenance adapter).
 */
export async function resolveOdometerForDevice(deviceId) {
  if (deviceId == null) {
    return {
      odometerKm: null,
      odometerConfidence: 'unavailable',
      odometerDriftPct: null,
      odometerDriftClass: 'unknown',
      resolutionMode: 'unavailable',
      diagnostics: [],
    };
  }
  return resolveVehicleOdometer({
    merged: { position: null, device: null },
    deviceId: Number(deviceId),
  });
}
