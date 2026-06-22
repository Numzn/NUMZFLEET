/**
 * Session-level rollups from refuel rows (pure functions; no I/O).
 */

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function plannedOrEstimatedFuel(row) {
  const planned = row.plannedFuelLitres != null ? Number(row.plannedFuelLitres) : null;
  if (planned != null && Number.isFinite(planned) && planned > 0) {
    return planned;
  }
  return toNumber(row.estimatedFuelLitres);
}

export function summarizeTotalsFromRefuels(refuels = []) {
  return refuels.reduce((acc, row) => {
    acc.totalEstimatedFuel += plannedOrEstimatedFuel(row);
    acc.totalActualFuel += toNumber(row.actualFuelLitres ?? row.fuelAmount);
    acc.totalEstimatedCost += toNumber(row.estimatedCost);
    acc.totalActualCost += toNumber(row.actualCost ?? row.fuelCost);
    return acc;
  }, {
    totalEstimatedFuel: 0,
    totalActualFuel: 0,
    totalEstimatedCost: 0,
    totalActualCost: 0,
    totalVarianceCost: 0,
  });
}

export function withVarianceCost(totals) {
  return {
    ...totals,
    totalVarianceCost: Number((totals.totalActualCost - totals.totalEstimatedCost).toFixed(2)),
  };
}

/**
 * Split planned/actual litres and actual cost by fuel type. Rows without a
 * `fuelTypeSnapshot` fall back to diesel so historical data still aggregates.
 */
export function summarizeByFuelType(refuels = []) {
  const empty = () => ({ plannedL: 0, actualL: 0, cost: 0 });
  const out = { diesel: empty(), petrol: empty() };

  for (const row of refuels) {
    const key = row.fuelTypeSnapshot === 'petrol' ? 'petrol' : 'diesel';
    const bucket = out[key];
    bucket.plannedL += plannedOrEstimatedFuel(row);
    bucket.actualL += toNumber(row.actualFuelLitres ?? row.fuelAmount);
    bucket.cost += toNumber(row.actualCost ?? row.fuelCost);
  }

  for (const key of Object.keys(out)) {
    out[key].plannedL = Number(out[key].plannedL.toFixed(2));
    out[key].actualL = Number(out[key].actualL.toFixed(2));
    out[key].cost = Number(out[key].cost.toFixed(2));
  }

  return out;
}

export function buildStatusCounts(refuels = []) {
  return refuels.reduce((acc, row) => {
    const key = row.status || 'normal';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { normal: 0, warning: 0, flagged: 0, incomplete: 0 });
}

export function uniqueVehicleCount(refuels = []) {
  return new Set(refuels.map((row) => Number(row.vehicleId))).size;
}
