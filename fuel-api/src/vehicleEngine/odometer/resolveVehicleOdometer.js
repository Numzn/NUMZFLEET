import { collectEvidence } from './collectEvidence.js';
import { resolveOdometerKm } from './resolveOdometer.js';
import {
  validateTelemetryFreshness,
  detectResetSuspected,
  detectUnitSuspicion,
} from './validateEvidence.js';
import { calculateDrift } from './calculateDrift.js';
import { scoreConfidence } from './scoreConfidence.js';

/**
 * Vehicle Odometer Engine — single resolution cycle (M2 §3).
 * @param {{ merged: object, deviceId: number|null }}
 */
export async function resolveVehicleOdometer({ merged, deviceId }) {
  const evidence = await collectEvidence({ merged, deviceId });

  const freshness = validateTelemetryFreshness({
    device: evidence.device,
    position: evidence.position,
  });

  const reset = detectResetSuspected(
    evidence.anchor?.anchorTelemetryKm ?? null,
    evidence.telemetryKm,
  );

  const unit = detectUnitSuspicion(evidence.telemetryAttribute);

  const diagnostics = [
    ...freshness.diagnostics,
    ...reset.diagnostics,
    ...unit.diagnostics,
  ];

  const { odometerKm, resolutionMode } = resolveOdometerKm({
    anchorKm: evidence.anchor?.anchorKm ?? null,
    anchorTelemetryKm: evidence.anchor?.anchorTelemetryKm ?? null,
    currentTelemetryKm: evidence.telemetryKm,
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
