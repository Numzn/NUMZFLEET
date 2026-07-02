import { VehicleSpec } from '../../models/index.js';
import { getVehicleTelemetry } from '../../services/refuelTelemetryService.js';
import { clearCache } from '../../services/vehicleSpecService.js';
import { extractTelemetryEvidence } from './normaliseEvidence.js';

/**
 * Record an Odometer Observation and update calibration anchor (M2 §4.3, §8).
 */
export async function applyObservation(deviceId, odometerKm, source = 'manual') {
  const km = Number(odometerKm);
  if (!Number.isFinite(km) || km < 0) {
    const error = new Error('odometerKm must be a non-negative number');
    error.statusCode = 400;
    throw error;
  }

  const telemetry = await getVehicleTelemetry(deviceId);
  let anchorTelemetryKm = null;
  if (telemetry.positionAttributes) {
    const extracted = extractTelemetryEvidence(telemetry.positionAttributes);
    anchorTelemetryKm = extracted.km;
  }

  const existing = await VehicleSpec.findOne({ where: { deviceId: Number(deviceId) } });
  const patch = {
    verifiedOdometerKm: km,
    verifiedOdometerAt: new Date(),
    verifiedOdometerSource: source,
    verifiedTraccarDistance: anchorTelemetryKm,
  };

  let spec;
  if (existing) {
    spec = await existing.update(patch);
  } else {
    spec = await VehicleSpec.create({
      deviceId: Number(deviceId),
      tankCapacity: 60,
      fuelEfficiency: 10,
      fuelType: 'Petrol',
      ...patch,
    });
  }

  clearCache(deviceId);
  return spec;
}
