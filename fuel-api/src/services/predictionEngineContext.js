import { resolveOdometerForDevice } from '../vehicleEngine/odometer/resolveVehicleOdometer.js';
import { getVehicleSpec } from './vehicleSpecService.js';
import { getVehicleFuelStatistics } from './vehicleFuelStatisticsService.js';

/**
 * Lightweight vehicle-engine context for prediction (device id = Traccar device).
 */
export async function loadPredictionEngineContext(deviceId) {
  const [odometer, stats] = await Promise.all([
    resolveOdometerForDevice(Number(deviceId)),
    getVehicleFuelStatistics(Number(deviceId)),
  ]);
  return {
    odometerKm: odometer.odometerKm ?? stats.liveOdometerKm ?? null,
    odometerConfidence: odometer.odometerConfidence ?? stats.liveOdometerConfidence ?? null,
    fuel: {
      tankLevelPct: null,
      efficiencyKmL: stats.fuelPerformance?.kmPerLitre ?? null,
      confidence: stats.confidenceScore ?? 0,
      efficiencySource: stats.fuelPerformance?.efficiencySource ?? null,
    },
  };
}

export async function loadPredictionEngineContextWithSpec(deviceId) {
  const [base, spec] = await Promise.all([
    loadPredictionEngineContext(deviceId),
    getVehicleSpec(Number(deviceId)),
  ]);
  if (spec?.fuelEfficiency != null && base.fuel.efficiencyKmL == null) {
    base.fuel.efficiencyKmL = Number(spec.fuelEfficiency);
    base.fuel.efficiencySource = 'spec';
  }
  return base;
}
