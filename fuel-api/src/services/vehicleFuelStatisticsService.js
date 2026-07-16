import { resolveOdometerForDevice } from '../vehicleEngine/odometer/resolveVehicleOdometer.js';
import { findCompletedRefuelsByVehicleId } from '../repositories/operationSessionRefuelRepository.js';
import {
  buildValidatedIntervals,
  calculateTankToTankEfficiency,
  DEFAULT_WINDOW_DAYS,
  scoreFuelConfidence,
} from '../utils/fuelEfficiencyUtils.js';
import { getVehicleSpec } from './vehicleSpecService.js';
import { INTERVAL_STATUS, odometerConfidenceToNumeric } from '../vehicleEngine/fuel/intervalValidator.js';

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

  // Flagged rows (e.g. actualFuelLitres exceeding a verified tank capacity) are excluded
  // from volume inputs so a single bad entry can't corrupt averageRefillLitres/
  // lastRefillLitres and, downstream, the Plan forecast. `last` still falls back to the
  // most recent row overall for date/mileage continuity, but `lastClean` — and therefore
  // lastRefillLitres — stays null rather than ever surfacing a flagged litres value.
  const cleanSorted = sorted.filter((r) => r.status !== 'flagged');
  const lastClean = cleanSorted[cleanSorted.length - 1] ?? null;
  const last = lastClean ?? sorted[sorted.length - 1];
  const litres = cleanSorted.map((r) => Number(r.actualFuelLitres)).filter((n) => Number.isFinite(n) && n > 0);
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
    lastRefillLitres: lastClean ? Number(lastClean.actualFuelLitres) : null,
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

/**
 * Recent fueling sessions for one vehicle, newest first, each row annotated
 * with the tank-to-tank economy calculated against the *previous* refuel
 * (when that interval is learnable). Powers the Fuel tab's history list.
 */
export async function getVehicleFuelHistory(vehicleId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 50);
  // Fetch a wider window than requested so the oldest displayed row still has
  // a learnable interval against the refuel just before it.
  const rows = await findCompletedRefuelsByVehicleId(vehicleId, Math.max(limit + 5, 20));
  const vehicleSpec = await getVehicleSpec(Number(vehicleId));
  const tankCapacity = vehicleSpec?.tankCapacity ?? null;
  const specEfficiencyKmL = vehicleSpec?.fuelEfficiency ?? null;

  const intervals = buildValidatedIntervals(rows, {
    windowDays: null,
    tankCapacity,
    specEfficiencyKmL,
  });
  const economyByRefuelId = new Map();
  const distanceByRefuelId = new Map();
  for (const interval of intervals) {
    if (interval.refuelId == null) continue;
    if (interval.kmPerLitre != null) economyByRefuelId.set(interval.refuelId, interval.kmPerLitre);
    if (interval.distanceKm != null) distanceByRefuelId.set(interval.refuelId, interval.distanceKm);
  }

  const sorted = [...rows].sort(
    (a, b) => new Date(b.sessionDate || b.createdAt) - new Date(a.sessionDate || a.createdAt),
  );

  return sorted.slice(0, limit).map((row) => ({
    refuelId: row.id,
    sessionId: row.sessionId,
    date: row.sessionDate || row.createdAt,
    litres: row.actualFuelLitres != null ? Number(row.actualFuelLitres) : null,
    odometerKm: row.currentMileage != null ? Number(row.currentMileage) : null,
    pricePerLitre: row.erbPricePerLitre != null ? Number(row.erbPricePerLitre) : null,
    totalCost: row.actualCost != null ? Number(row.actualCost) : null,
    economyKmPerL: economyByRefuelId.get(row.id) ?? null,
    distanceSinceLastKm: distanceByRefuelId.get(row.id) ?? null,
    status: row.status,
  }));
}

/**
 * Compact KPI set for the Fuel Trends section: monthly spend, average
 * economy, average litres per fill, cost per km, and average distance
 * between refuels. Cost-per-km pairs each learnable interval's distance
 * with the cost of the refuel that closed it (the fill that covered that
 * distance) — an approximation, not an accounting-grade allocation.
 */
export async function getVehicleFuelTrends(vehicleId) {
  const stats = await getVehicleFuelStatistics(vehicleId);
  const rows = await findCompletedRefuelsByVehicleId(vehicleId, 48);

  const rowById = new Map(rows.map((r) => [r.id, r]));
  let costSum = 0;
  let costDistanceKm = 0;
  for (const interval of stats.fuelPerformance?.intervals ?? []) {
    if (interval.status !== INTERVAL_STATUS.LEARNABLE) continue;
    const currentRow = rowById.get(interval.refuelId);
    const cost = currentRow?.actualCost != null ? Number(currentRow.actualCost) : null;
    if (cost != null && interval.distanceKm > 0) {
      costSum += cost;
      costDistanceKm += interval.distanceKm;
    }
  }
  const costPerKmZmw = costDistanceKm > 0 ? Number((costSum / costDistanceKm).toFixed(2)) : null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyCosts = rows
    .filter((r) => {
      const d = new Date(r.sessionDate || r.createdAt);
      return !Number.isNaN(d.getTime()) && d >= monthStart;
    })
    .map((r) => Number(r.actualCost))
    .filter((n) => Number.isFinite(n) && n > 0);
  const monthlySpendZmw = monthlyCosts.length
    ? Number(monthlyCosts.reduce((s, v) => s + v, 0).toFixed(2))
    : null;

  return {
    vehicleId: Number(vehicleId),
    monthlySpendZmw,
    averageEconomyKmPerL: stats.fuelPerformance?.kmPerLitre ?? null,
    averageLitresPerFill: stats.averageRefillLitres,
    costPerKmZmw,
    averageDistanceBetweenRefuelsKm: stats.averageKmBetweenRefills,
  };
}
