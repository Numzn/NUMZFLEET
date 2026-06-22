/**
 * History-based fuel demand prediction (not tank balance).
 */

export function confidenceLevelFromPercent(confidencePercent) {
  const p = Number(confidencePercent);
  if (!Number.isFinite(p)) return 'LOW';
  if (p >= 85) return 'HIGH';
  if (p >= 70) return 'MEDIUM';
  return 'LOW';
}

/**
 * @param {import('../services/vehicleFuelStatisticsService.js').getVehicleFuelStatistics extends Function ? Awaited<ReturnType<...>> : object} stats
 */
export function predictRefuelQuantity(stats) {
  const sampleCount = Number(stats?.sampleCount || 0);
  if (sampleCount === 0) {
    return {
      predictedLitres: null,
      confidencePercent: 0,
      confidenceLevel: 'LOW',
    };
  }

  const avg = Number(stats.averageRefillLitres);
  const last = Number(stats.lastRefillLitres);
  let predicted = avg;
  if (stats.fuelTrend === 'increasing' && Number.isFinite(last)) {
    predicted = last * 1.05;
  } else if (stats.fuelTrend === 'decreasing' && Number.isFinite(last)) {
    predicted = last * 0.95;
  } else if (Number.isFinite(last)) {
    predicted = (avg + last) / 2;
  }

  if (!Number.isFinite(predicted) || predicted <= 0) {
    predicted = last > 0 ? last : 50;
  }

  const confidencePercent = Math.min(100, Math.max(0, Number(stats.confidenceScore || 0)));

  return {
    predictedLitres: Number(Math.max(1, predicted).toFixed(1)),
    confidencePercent,
    confidenceLevel: confidenceLevelFromPercent(confidencePercent),
  };
}

export async function predictForVehicle(vehicleId, getStatsFn) {
  const stats = await getStatsFn(vehicleId);
  const prediction = predictRefuelQuantity(stats);
  return { vehicleId: Number(vehicleId), statistics: stats, ...prediction };
}
