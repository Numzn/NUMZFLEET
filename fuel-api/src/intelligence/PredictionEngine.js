/**
 * History-based fuel demand prediction (not tank balance).
 * Historical km gaps use stored refuel snapshots; live odometer/fuel from the
 * vehicle engine may adjust confidence but does not replace history.
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
export function predictRefuelQuantity(stats, engineContext = null) {
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

  let confidencePercent = Math.min(100, Math.max(0, Number(stats.confidenceScore || 0)));

  const liveConfidence = engineContext?.odometerConfidence
    ?? stats.liveOdometerConfidence
    ?? null;
  if (liveConfidence === 'high' && confidencePercent > 0 && confidencePercent < 90) {
    confidencePercent = Math.min(90, confidencePercent + 5);
  }
  if (engineContext?.fuel?.confidence != null && confidencePercent > 0) {
    const fuelConf = Number(engineContext.fuel.confidence);
    if (Number.isFinite(fuelConf) && fuelConf >= 70) {
      confidencePercent = Math.min(100, confidencePercent + 3);
    }
  }

  return {
    predictedLitres: Number(Math.max(1, predicted).toFixed(1)),
    confidencePercent,
    confidenceLevel: confidenceLevelFromPercent(confidencePercent),
  };
}

export async function predictForVehicle(vehicleId, getStatsFn, options = {}) {
  const stats = await getStatsFn(vehicleId, options);
  let engineContext = options.engineContext ?? null;
  if (!engineContext && typeof options.loadEngineContext === 'function') {
    try {
      engineContext = await options.loadEngineContext(vehicleId);
    } catch {
      engineContext = null;
    }
  }
  const prediction = predictRefuelQuantity(stats, engineContext);
  return {
    vehicleId: Number(vehicleId),
    statistics: stats,
    liveOdometerKm: engineContext?.odometerKm ?? stats.liveOdometerKm ?? null,
    liveOdometerConfidence: engineContext?.odometerConfidence ?? stats.liveOdometerConfidence ?? null,
    fuelSnapshot: engineContext?.fuel ?? null,
    ...prediction,
  };
}
