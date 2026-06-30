import { getVehicleFuelStatistics } from '../../services/vehicleFuelStatisticsService.js';

export async function buildFuelHub(deviceId, merged) {
  const specEfficiency = merged?.vehicleSpec?.fuelEfficiency ?? null;
  const tankCapacity = merged?.vehicleSpec?.tankCapacity ?? null;
  const telemetry = merged?.position?.telemetry ?? null;
  const tankLevelPct = telemetry?.fuelPct != null ? Math.round(Number(telemetry.fuelPct)) : null;

  if (!deviceId) {
    return {
      lastRefuel: null,
      tankLevelPct,
      kmPerLitre: specEfficiency,
      measured: false,
      trend: null,
      specEfficiency,
      tankCapacity,
    };
  }

  try {
    const stats = await getVehicleFuelStatistics(Number(deviceId));
    const perf = stats?.fuelPerformance;
    const measured = Boolean(perf?.measured && perf?.kmPerLitre != null);

    return {
      lastRefuel: stats.lastRefillDate
        ? {
          date: stats.lastRefillDate,
          litres: stats.lastRefillLitres,
          mileageKm: stats.lastRefillMileage,
        }
        : null,
      tankLevelPct,
      kmPerLitre: measured ? Number(perf.kmPerLitre) : specEfficiency,
      measured,
      trend: stats.fuelTrend || null,
      sampleCount: stats.sampleCount ?? 0,
      specEfficiency,
      tankCapacity,
    };
  } catch {
    return {
      lastRefuel: null,
      tankLevelPct,
      kmPerLitre: specEfficiency,
      measured: false,
      trend: null,
      specEfficiency,
      tankCapacity,
    };
  }
}
