import { estimateFuelLitres } from './EstimationEngine.js';

/**
 * Rank vehicles by estimated litres needed to fill (descending) for operational prioritization.
 * @param {Array<{ vehicleId: number, tankCapacity?: number, tankLevelFraction: number|null, fuelType?: string }>} candidates
 */
export function rankVehiclesByRefuelUrgency(candidates = []) {
  const scored = candidates
    .map((c) => {
      const cap = Number(c.tankCapacity);
      const est = estimateFuelLitres({
        tankCapacity: cap,
        tankLevelFraction: c.tankLevelFraction,
      });
      return {
        vehicleId: Number(c.vehicleId),
        estimatedFuelLitres: est,
        tankLevelFraction: c.tankLevelFraction,
        tankCapacity: Number.isFinite(cap) ? cap : null,
        fuelType: c.fuelType ?? null,
      };
    })
    .filter((r) => Number.isFinite(r.vehicleId) && r.vehicleId > 0);

  scored.sort((a, b) => b.estimatedFuelLitres - a.estimatedFuelLitres);
  return scored;
}

/**
 * Exclude vehicle IDs already present in the session (by refuel rows).
 */
export function excludeAlreadyInSession(vehicleIds, refuels = []) {
  const inSession = new Set(refuels.map((r) => Number(r.vehicleId)));
  return vehicleIds.filter((id) => !inSession.has(Number(id)));
}
