import { estimateFuelLitres } from './EstimationEngine.js';
import { computeVariance, mergeStatusWithCapacityFlag, validateRefuelActualDraft } from './ValidationEngine.js';

/**
 * Row completeness for pre-filled refuel lines (quick start / plan).
 * incomplete = missing tank capacity or missing fuel level telemetry (mileage defaults to 0).
 */
export function computePrefillCompleteness({
  tankCapacity,
  tankLevelFraction,
  telemetryMileage,
}) {
  const cap = Number(tankCapacity);
  const hasValidCapacity = Number.isFinite(cap) && cap > 0;
  let levelFrac = tankLevelFraction;
  if (levelFrac != null && Number.isFinite(Number(levelFrac))) {
    levelFrac = Number(levelFrac);
    if (levelFrac > 1 && levelFrac <= 100) levelFrac /= 100;
  } else {
    levelFrac = null;
  }

  const mileage = telemetryMileage != null && Number.isFinite(Number(telemetryMileage))
    ? Number(telemetryMileage)
    : 0;

  const incomplete = !hasValidCapacity || levelFrac == null;

  return {
    hasValidCapacity,
    tankLevelFraction: levelFrac,
    currentMileage: mileage,
    incomplete,
  };
}

/**
 * Litres dispensed from pump totals.
 */
export function actualLitresFromPump({ pumpStart, pumpEnd }) {
  const a = Number(pumpStart);
  const b = Number(pumpEnd);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) {
    return null;
  }
  return Number((b - a).toFixed(3));
}

/**
 * Resolve actual litres from body: pump pair takes precedence when both valid.
 */
export function resolveActualFuelLitres({ actualFuelLitres, pumpStart, pumpEnd }) {
  const draft = validateRefuelActualDraft({
    actualFuelLitres,
    tankCapacitySnapshot: null,
    pumpStart,
    pumpEnd,
  });
  if (!draft.ok) {
    return { error: draft.error };
  }
  return { actualFuelLitres: draft.actualLitres };
}

/**
 * Build variance + row patch for persistence after actual is known.
 */
export function buildRefuelMetricsPatch({
  actualFuelLitres,
  estimatedFuelLitres,
  pricePerLitre,
  tankCapacitySnapshot,
  exceedsCapacityOverride,
}) {
  const variance = computeVariance(actualFuelLitres, estimatedFuelLitres);
  const exceedsCapacity = Boolean(exceedsCapacityOverride)
    || (Number.isFinite(Number(tankCapacitySnapshot))
      && actualFuelLitres > Number(tankCapacitySnapshot));
  const status = mergeStatusWithCapacityFlag(variance.status, exceedsCapacity);
  const est = Number(estimatedFuelLitres);
  const act = Number(actualFuelLitres);
  const estimatedCost = pricePerLitre != null && Number.isFinite(est)
    ? Number((est * pricePerLitre).toFixed(2))
    : null;
  const actualCost = pricePerLitre != null && Number.isFinite(act)
    ? Number((act * pricePerLitre).toFixed(2))
    : null;

  return {
    actualFuelLitres: act,
    fuelAmount: act,
    varianceLitres: variance.varianceLitres,
    variancePercent: variance.variancePercent,
    status,
    estimatedCost,
    actualCost,
    meterFuelLitres: null,
    meterVariance: null,
  };
}

/**
 * Pre-fill refuel row fields (before DB insert).
 */
export function buildPrefillRefuelRow({
  sessionId,
  userId,
  vehicleId,
  tankCapacity,
  tankLevelFraction,
  telemetryMileage,
  pricePerLitre,
  sessionDate,
  plannedFuelLitres = null,
  fuelTypeSnapshot = null,
}) {
  const {
    hasValidCapacity,
    tankLevelFraction: levelFrac,
    currentMileage,
    incomplete,
  } = computePrefillCompleteness({ tankCapacity, tankLevelFraction, telemetryMileage });

  let estimatedFuelLitres = null;
  if (hasValidCapacity) {
    estimatedFuelLitres = estimateFuelLitres({
      tankCapacity: Number(tankCapacity),
      tankLevelFraction: levelFrac,
    });
  }

  const plannedNum = plannedFuelLitres != null ? Number(plannedFuelLitres) : null;
  const hasPlanned = Number.isFinite(plannedNum) && plannedNum > 0;

  const telemetryEstimatedCost = pricePerLitre != null && estimatedFuelLitres != null
    ? Number((estimatedFuelLitres * pricePerLitre).toFixed(2))
    : null;
  const plannedEstimatedCost = hasPlanned && pricePerLitre != null
    ? Number((plannedNum * pricePerLitre).toFixed(2))
    : null;
  const estimatedCost = plannedEstimatedCost ?? telemetryEstimatedCost;

  const cap = Number(tankCapacity);
  const status = hasPlanned ? 'normal' : (incomplete ? 'incomplete' : 'normal');

  return {
    sessionId,
    userId,
    vehicleId,
    fuelCost: 0,
    fuelAmount: 0,
    plannedFuelLitres: hasPlanned ? plannedNum : null,
    estimatedFuelLitres,
    actualFuelLitres: null,
    varianceLitres: null,
    variancePercent: null,
    status,
    erbPricePerLitre: pricePerLitre,
    fuelTypeSnapshot,
    estimatedCost,
    actualCost: null,
    tankLevelStart: levelFrac,
    tankCapacitySnapshot: hasValidCapacity ? cap : null,
    currentMileage,
    attendant: null,
    pumpNumber: null,
    sessionDate,
    locked: false,
  };
}

/** Recompute estimate + incomplete status from tank snapshot fields (Run screen metadata edits). */
export function estimateFromTankMetadata({ tankCapacitySnapshot, tankLevelStart, pricePerLitre }) {
  const {
    hasValidCapacity,
    tankLevelFraction: levelFrac,
    incomplete,
  } = computePrefillCompleteness({
    tankCapacity: tankCapacitySnapshot,
    tankLevelFraction: tankLevelStart,
    telemetryMileage: 0,
  });

  let estimatedFuelLitres = null;
  if (hasValidCapacity) {
    estimatedFuelLitres = estimateFuelLitres({
      tankCapacity: Number(tankCapacitySnapshot),
      tankLevelFraction: levelFrac,
    });
  }

  const cap = Number(tankCapacitySnapshot);
  const estimatedCost = pricePerLitre != null && estimatedFuelLitres != null
    ? Number((estimatedFuelLitres * pricePerLitre).toFixed(2))
    : null;

  return {
    estimatedFuelLitres,
    estimatedCost,
    tankCapacitySnapshot: hasValidCapacity ? cap : null,
    tankLevelStart: levelFrac,
    status: incomplete ? 'incomplete' : 'normal',
  };
}
