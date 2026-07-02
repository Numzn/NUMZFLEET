import { resolveOdometerForDevice } from '../odometer/resolveVehicleOdometer.js';

/**
 * Capture odometer snapshot at refuel save time using Vehicle Odometer Engine.
 *
 * @param {{
 *   deviceId: number,
 *   clientMileage?: number|null,
 *   clientMileageSource?: string|null,
 * }}
 */
export async function captureRefuelOdometer({
  deviceId,
  clientMileage = null,
  clientMileageSource = null,
}) {
  const odometerState = await resolveOdometerForDevice(Number(deviceId));

  const isManual = clientMileageSource === 'manual'
    && clientMileage != null
    && Number.isFinite(Number(clientMileage));

  const mileage = isManual
    ? Number(clientMileage)
    : (odometerState.odometerKm ?? (clientMileage != null ? Number(clientMileage) : null));

  const mileageSource = isManual
    ? 'manual'
    : (odometerState.odometerKm != null ? 'snapshot' : (clientMileageSource || 'snapshot'));

  return {
    currentMileage: mileage,
    mileageSource,
    odometerConfidenceAtCapture: odometerState.odometerConfidence ?? 'unavailable',
    odometerResolutionModeAtCapture: odometerState.resolutionMode ?? null,
    odometerDriftClassAtCapture: odometerState.odometerDriftClass ?? 'unknown',
    odometerState,
  };
}

export default { captureRefuelOdometer };
