import { validateInterval, INTERVAL_STATUS, odometerConfidenceToNumeric } from '../vehicleEngine/fuel/intervalValidator.js';

const DEFAULT_WINDOW_DAYS = 30;

function refuelTimestamp(row) {
  const t = new Date(row?.sessionDate || row?.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function refuelDate(row) {
  return new Date(row?.sessionDate || row?.createdAt);
}

/**
 * Build validated tank-to-tank intervals from consecutive refuel rows.
 */
export function buildValidatedIntervals(refuelRows = [], options = {}) {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const tankCapacity = options.tankCapacity ?? null;
  const specEfficiencyKmL = options.specEfficiencyKmL ?? null;
  const cutoff = windowDays != null
    ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    : null;

  const sorted = [...refuelRows]
    .filter((row) => {
      const litres = Number(row?.actualFuelLitres);
      if (!Number.isFinite(litres) || litres <= 0) return false;
      if (cutoff) {
        const d = refuelDate(row);
        if (Number.isNaN(d.getTime()) || d < cutoff) return false;
      }
      return true;
    })
    .sort((a, b) => refuelTimestamp(a) - refuelTimestamp(b));

  const intervals = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const validation = validateInterval({
      previous,
      current,
      tankCapacity,
      specEfficiencyKmL,
    });
    intervals.push({
      previousRefuelId: previous.id ?? null,
      refuelId: current.id ?? null,
      eventAt: current.sessionDate || current.createdAt,
      ...validation,
      kmPerLitre: validation.efficiencyKmL ?? null,
      lPer100km: validation.efficiencyKmL != null && validation.efficiencyKmL > 0
        ? Number(((validation.fuel / validation.distanceKm) * 100).toFixed(1))
        : null,
    });
  }

  return intervals;
}

/**
 * Tank-to-tank fuel efficiency from consecutive operation refuel rows.
 * Only LEARNABLE intervals contribute to aggregates.
 */
export function calculateTankToTankEfficiency(refuelRows = [], options = {}) {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const intervals = buildValidatedIntervals(refuelRows, options);

  const learnable = intervals.filter((i) => i.status === INTERVAL_STATUS.LEARNABLE);
  const stored = intervals.filter((i) => i.status === INTERVAL_STATUS.STORED_ONLY);
  const rejected = intervals.filter((i) => i.status === INTERVAL_STATUS.REJECTED);
  const flagged = intervals.filter((i) => i.status === INTERVAL_STATUS.FLAGGED);

  let totalDistanceKm = 0;
  let totalFuelLitres = 0;
  for (const interval of learnable) {
    totalDistanceKm += interval.distanceKm;
    totalFuelLitres += interval.fuel;
  }

  const sorted = [...refuelRows]
    .filter((row) => {
      const litres = Number(row?.actualFuelLitres);
      if (!Number.isFinite(litres) || litres <= 0) return false;
      const cutoff = windowDays != null
        ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
        : null;
      if (cutoff) {
        const d = refuelDate(row);
        if (Number.isNaN(d.getTime()) || d < cutoff) return false;
      }
      return true;
    });

  const base = {
    totalDistanceKm: totalDistanceKm > 0 ? Number(totalDistanceKm.toFixed(0)) : null,
    totalFuelLitres: totalFuelLitres > 0 ? Number(totalFuelLitres.toFixed(1)) : null,
    intervalCount: learnable.length,
    learnableIntervalCount: learnable.length,
    storedIntervalCount: stored.length,
    rejectedIntervalCount: rejected.length,
    flaggedIntervalCount: flagged.length,
    refuelCountInWindow: sorted.length,
    windowDays,
    measured: learnable.length >= 1,
    kmPerLitre: null,
    lPer100km: null,
    intervals,
  };

  if (learnable.length < 1 || totalFuelLitres <= 0 || totalDistanceKm <= 0) {
    return base;
  }

  const kmPerLitre = totalDistanceKm / totalFuelLitres;
  return {
    ...base,
    kmPerLitre: Number(kmPerLitre.toFixed(2)),
    lPer100km: Number(((totalFuelLitres / totalDistanceKm) * 100).toFixed(1)),
    measured: true,
  };
}

/**
 * Blend interval quality with odometer confidence at capture.
 */
export function scoreFuelConfidence({
  sampleCount = 0,
  learnableIntervalCount = 0,
  litreValues = [],
  worstOdometerConfidence = 'unavailable',
}) {
  const mean = (values) => {
    if (!values.length) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  };
  const stdDev = (values, avg) => {
    if (values.length < 2) return 0;
    const m = avg ?? mean(values);
    const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  };

  const avgLitres = mean(litreValues);
  const cv = avgLitres > 0 ? (stdDev(litreValues, avgLitres) / avgLitres) : 1;
  let intervalQuality = Math.min(100, Math.round(sampleCount * 18 - cv * 30));
  intervalQuality = Math.max(0, intervalQuality);
  if (learnableIntervalCount >= 2) intervalQuality = Math.min(100, intervalQuality + 10);
  if (learnableIntervalCount >= 4) intervalQuality = Math.min(100, intervalQuality + 10);

  const odometerNumeric = odometerConfidenceToNumeric(worstOdometerConfidence);
  const blended = Math.round(0.6 * intervalQuality + 0.4 * odometerNumeric);
  return Math.max(0, Math.min(100, blended));
}

export { DEFAULT_WINDOW_DAYS };
