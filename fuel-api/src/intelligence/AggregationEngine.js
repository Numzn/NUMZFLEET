/**
 * Session-level rollups from refuel rows (pure functions; no I/O).
 */

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeTotalsFromRefuels(refuels = []) {
  return refuels.reduce((acc, row) => {
    acc.totalEstimatedFuel += toNumber(row.estimatedFuelLitres);
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
