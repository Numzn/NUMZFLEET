import { getVehicleFuelStatistics } from '../../services/vehicleFuelStatisticsService.js';
import { resolveOdometerForDevice } from '../odometer/resolveVehicleOdometer.js';
import { normalizeFuelLevelFromAttrs } from '../../utils/normalizeFuelLevel.js';

function resolveTankLevelPct(merged) {
  const telemetry = merged?.position?.telemetry ?? null;
  if (telemetry?.fuelPct != null) {
    return Math.round(Number(telemetry.fuelPct));
  }
  const attrs = merged?.position?.attributes;
  if (attrs && typeof attrs === 'object') {
    const pct = normalizeFuelLevelFromAttrs(attrs);
    return pct != null ? Math.round(pct) : null;
  }
  return null;
}

export async function buildFuelHub(deviceId, merged) {
  const specEfficiency = merged?.vehicleSpec?.fuelEfficiency ?? null;
  const tankCapacity = merged?.vehicleSpec?.tankCapacity ?? null;
  const tankLevelPct = resolveTankLevelPct(merged);
  const tankLevelSource = tankLevelPct != null ? 'telemetry' : 'unavailable';

  if (!deviceId) {
    return {
      lastRefuel: null,
      tankLevelPct,
      tankLevelSource,
      kmPerLitre: specEfficiency,
      measured: false,
      trend: null,
      specEfficiency,
      tankCapacity,
      sampleCount: 0,
      confidenceScore: 0,
      fuelPerformance: null,
    };
  }

  try {
    const [stats, liveOdometer] = await Promise.all([
      getVehicleFuelStatistics(Number(deviceId)),
      resolveOdometerForDevice(Number(deviceId)),
    ]);
    const perf = stats?.fuelPerformance;
    const measured = Boolean(perf?.measured && perf?.kmPerLitre != null);

    return {
      lastRefuel: stats.lastRefillDate
        ? {
          date: stats.lastRefillDate,
          litres: stats.lastRefillLitres,
          mileageKm: liveOdometer.odometerKm ?? stats.liveOdometerKm ?? null,
        }
        : null,
      liveOdometerKm: liveOdometer.odometerKm ?? null,
      liveOdometerConfidence: liveOdometer.odometerConfidence ?? 'unavailable',
      tankLevelPct,
      tankLevelSource,
      kmPerLitre: measured ? Number(perf.kmPerLitre) : specEfficiency,
      measured,
      trend: stats.fuelTrend || null,
      sampleCount: stats.sampleCount ?? 0,
      confidenceScore: stats.confidenceScore ?? 0,
      intervalCount: perf?.intervalCount ?? 0,
      windowDays: perf?.windowDays ?? null,
      fuelPerformance: perf ?? null,
      specEfficiency,
      tankCapacity,
    };
  } catch {
    return {
      lastRefuel: null,
      tankLevelPct,
      tankLevelSource,
      kmPerLitre: specEfficiency,
      measured: false,
      trend: null,
      specEfficiency,
      tankCapacity,
      sampleCount: 0,
      confidenceScore: 0,
      fuelPerformance: null,
    };
  }
}
