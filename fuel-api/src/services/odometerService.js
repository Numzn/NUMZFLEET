import { VehicleSpec } from '../models/index.js';
import { getVehicleTelemetry } from './refuelTelemetryService.js';
import { clearCache } from './vehicleSpecService.js';

/**
 * Pure odometer math: verified baseline + Traccar distance travelled since the
 * baseline was captured. Negative deltas (e.g. a device reset) are clamped to
 * zero so the computed reading never drops below the verified anchor. Falls back
 * to the raw Traccar reading when no verified baseline exists.
 */
export function computeOdometerFromBaseline({ verifiedKm, verifiedDist, currentTraccar }) {
  const hasCurrent = currentTraccar != null && Number.isFinite(Number(currentTraccar));
  const current = hasCurrent ? Number(currentTraccar) : null;

  if (verifiedKm != null && verifiedDist != null && current != null) {
    const delta = current - Number(verifiedDist);
    const computed = Number(verifiedKm) + (delta > 0 ? delta : 0);
    return {
      odometer: Number(computed.toFixed(1)),
      source: 'computed',
      verifiedOdometerKm: Number(verifiedKm),
      traccarTotalDistance: current,
    };
  }

  return {
    odometer: current,
    source: current != null ? 'traccar' : 'unavailable',
    verifiedOdometerKm: verifiedKm != null ? Number(verifiedKm) : null,
    traccarTotalDistance: current,
  };
}

/**
 * Computed odometer for a device. Both the baseline snapshot and the live read
 * use the same telemetry resolver so the delta stays unit-consistent.
 *
 * @returns {Promise<{ odometer: number|null, source: 'computed'|'traccar'|'unavailable', verifiedOdometerKm: number|null, traccarTotalDistance: number|null }>}
 */
export async function getComputedOdometer(deviceId) {
  const spec = await VehicleSpec.findOne({ where: { deviceId: Number(deviceId) } });
  const telemetry = await getVehicleTelemetry(deviceId);
  const currentTraccar = telemetry.mileage != null ? Number(telemetry.mileage) : null;

  return computeOdometerFromBaseline({
    verifiedKm: spec?.verifiedOdometerKm != null ? Number(spec.verifiedOdometerKm) : null,
    verifiedDist: spec?.verifiedTraccarDistance != null ? Number(spec.verifiedTraccarDistance) : null,
    currentTraccar,
  });
}

/**
 * Anchor a trusted odometer reading and snapshot the current Traccar distance
 * so future computed readings can add the delta on top of it.
 */
export async function setVerifiedOdometer(deviceId, km, source = 'manual', userId = null) {
  const verifiedKm = Number(km);
  if (!Number.isFinite(verifiedKm) || verifiedKm < 0) {
    const error = new Error('verifiedOdometerKm must be a non-negative number');
    error.statusCode = 400;
    throw error;
  }

  const telemetry = await getVehicleTelemetry(deviceId);
  const traccarDistance = telemetry.mileage != null ? Number(telemetry.mileage) : null;

  const existing = await VehicleSpec.findOne({ where: { deviceId: Number(deviceId) } });
  const patch = {
    verifiedOdometerKm: verifiedKm,
    verifiedOdometerAt: new Date(),
    verifiedOdometerSource: source,
    verifiedTraccarDistance: traccarDistance,
  };

  let spec;
  if (existing) {
    spec = await existing.update(patch);
  } else {
    spec = await VehicleSpec.create({
      deviceId: Number(deviceId),
      ...patch,
    });
  }

  clearCache(deviceId);
  return spec;
}
