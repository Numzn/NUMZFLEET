import { resolveOdometerForDevice } from '../vehicleEngine/odometer/resolveVehicleOdometer.js';
import { findCompletedRefuelsByVehicleId } from '../repositories/operationSessionRefuelRepository.js';
import {
  calculateTankToTankEfficiency,
  DEFAULT_WINDOW_DAYS,
  scoreFuelConfidence,
} from '../utils/fuelEfficiencyUtils.js';
import { getVehicleSpec } from './vehicleSpecService.js';
import { odometerConfidenceToNumeric } from '../vehicleEngine/fuel/intervalValidator.js';

function daysBetween(a, b) {
  const ms = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  return ms / (1000 * 60 * 60 * 24);
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function computeTrend(recentAvg, priorAvg) {
  if (recentAvg == null || priorAvg == null || priorAvg <= 0) return 'stable';
  const pct = ((recentAvg - priorAvg) / priorAvg) * 100;
  if (pct > 5) return 'increasing';
  if (pct < -5) return 'decreasing';
  return 'stable';
}

function worstOdometerConfidence(rows) {
  let worst = 'high';
  for (const row of rows) {
    const c = row?.odometerConfidenceAtCapture ?? 'unavailable';
    if (odometerConfidenceToNumeric(c) < odometerConfidenceToNumeric(worst)) {
      worst = c;
    }
  }
  return worst;
}

/**
 * History-based vehicle fuel profile (no tank balance).
 */
export async function getVehicleFuelStatistics(vehicleId, options = {}) {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const rows = await findCompletedRefuelsByVehicleId(vehicleId, 48);
  const vehicleSpec = await getVehicleSpec(Number(vehicleId));
  const tankCapacity = vehicleSpec?.tankCapacity ?? null;
  const specEfficiencyKmL = vehicleSpec?.fuelEfficiency ?? null;
  const calcOptions = { windowDays, tankCapacity, specEfficiencyKmL };
  const emptyFuelPerformance = calculateTankToTankEfficiency([], calcOptions);

  if (!rows.length) {
    const liveOdometer = await resolveOdometerForDevice(Number(vehicleId));
    return {
      vehicleId: Number(vehicleId),
      lastRefillDate: null,
      lastRefillLitres: null,
      lastRefillMileage: null,
      liveOdometerKm: liveOdometer.odometerKm ?? null,
      liveOdometerConfidence: liveOdometer.odometerConfidence ?? 'unavailable',
      averageRefillLitres: null,
      averageKmBetweenRefills: null,
      averageDaysBetweenRefills: null,
      fuelTrend: 'stable',
      confidenceScore: 0,
      sampleCount: 0,
      fuelPerformance: emptyFuelPerformance,
    };
  }

  const sorted = [...rows].sort(
    (a, b) => new Date(a.sessionDate || a.createdAt) - new Date(b.sessionDate || b.createdAt),
  );

  const last = sorted[sorted.length - 1];
  const litres = sorted.map((r) => Number(r.actualFuelLitres)).filter((n) => Number.isFinite(n) && n > 0);
  const avgLitres = mean(litres);

  const kmGaps = [];
  const dayGaps = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const prevM = Number(prev.currentMileage);
    const curM = Number(cur.currentMileage);
    if (Number.isFinite(prevM) && Number.isFinite(curM) && curM > prevM) {
      kmGaps.push(curM - prevM);
    }
    dayGaps.push(daysBetween(prev.sessionDate || prev.createdAt, cur.sessionDate || cur.createdAt));
  }

  const recentLitres = litres.slice(-3);
  const priorLitres = litres.slice(-6, -3);
  const recentAvg = mean(recentLitres);
  const priorAvg = mean(priorLitres);
  const fuelTrend = computeTrend(recentAvg, priorAvg);

  const sampleCount = litres.length;
  const fuelPerformance = calculateTankToTankEfficiency(rows, calcOptions);
  const confidenceScore = scoreFuelConfidence({
    sampleCount,
    learnableIntervalCount: fuelPerformance.learnableIntervalCount ?? 0,
    litreValues: litres,
    worstOdometerConfidence: worstOdometerConfidence(sorted),
  });
  const liveOdometer = await resolveOdometerForDevice(Number(vehicleId));

  return {
    vehicleId: Number(vehicleId),
    lastRefillDate: last.sessionDate || last.createdAt,
    lastRefillLitres: Number(last.actualFuelLitres),
    lastRefillMileage: last.currentMileage != null ? Number(last.currentMileage) : null,
    liveOdometerKm: liveOdometer.odometerKm ?? null,
    liveOdometerConfidence: liveOdometer.odometerConfidence ?? 'unavailable',
    averageRefillLitres: avgLitres != null ? Number(avgLitres.toFixed(1)) : null,
    averageKmBetweenRefills: kmGaps.length ? Number(mean(kmGaps).toFixed(0)) : null,
    averageDaysBetweenRefills: dayGaps.length ? Number(mean(dayGaps).toFixed(1)) : null,
    fuelTrend,
    confidenceScore,
    sampleCount,
    fuelPerformance,
  };
}
