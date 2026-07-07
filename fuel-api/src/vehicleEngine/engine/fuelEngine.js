import { computeFleetFuelEfficiencyAverage } from '../../services/fleetFuelBenchmarkService.js';
import { buildFuelSnapshot } from '../fuel/fuelSnapshotBuilder.js';

export async function buildFuelEngine(companyId, hub, registry, options = {}) {
  const fuel = hub?.fuel ?? {};
  const learning = options.learning ?? null;

  let fleetDeltaPct = null;
  let fleetEfficiencyAvg = null;

  try {
    const bench = await computeFleetFuelEfficiencyAverage(companyId);
    fleetEfficiencyAvg = bench.avgKmPerLitre;
    const eff = fuel.kmPerLitre ?? registry?.vehicleSpec?.fuelEfficiency ?? null;
    if (eff != null && bench.avgKmPerLitre != null && bench.avgKmPerLitre > 0) {
      fleetDeltaPct = Math.round(
        ((eff - bench.avgKmPerLitre) / bench.avgKmPerLitre) * 1000,
      ) / 10;
    }
  } catch {
    /* optional benchmark */
  }

  return buildFuelSnapshot({
    hubFuel: fuel,
    registry,
    learning,
    fleetDeltaPct,
    fleetEfficiencyAvg,
    fuelState: options.fuelState ?? null,
  });
}
