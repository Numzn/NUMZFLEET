import { computeFleetFuelEfficiencyAverage } from '../../services/fleetFuelBenchmarkService.js';

export async function buildFuelEngine(companyId, hub, registry) {
  const fuel = hub?.fuel ?? {};
  const specEfficiency = registry?.vehicleSpec?.fuelEfficiency ?? null;
  let efficiencyKmL = fuel.kmPerLitre ?? specEfficiency;

  let fleetDeltaPct = null;
  let fleetEfficiencyAvg = null;

  try {
    const bench = await computeFleetFuelEfficiencyAverage(companyId);
    fleetEfficiencyAvg = bench.avgKmPerLitre;
    if (
      efficiencyKmL != null
      && bench.avgKmPerLitre != null
      && bench.avgKmPerLitre > 0
    ) {
      fleetDeltaPct = Math.round(
        ((efficiencyKmL - bench.avgKmPerLitre) / bench.avgKmPerLitre) * 1000,
      ) / 10;
    }
  } catch {
    /* optional benchmark */
  }

  let risk = null;
  if (fuel.tankLevelPct != null && fuel.tankLevelPct <= 15) risk = 'high';
  else if (fuel.tankLevelPct != null && fuel.tankLevelPct <= 25) risk = 'medium';
  else if (fuel.measured || fuel.tankLevelPct != null) risk = 'low';

  return {
    efficiencyKmL,
    measured: fuel.measured ?? false,
    fleetDeltaPct,
    fleetEfficiencyAvg,
    risk,
    trend: fuel.trend ?? null,
  };
}
