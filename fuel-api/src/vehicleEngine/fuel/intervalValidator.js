import {
  isConfirmedFull,
  isConfirmedPartial,
} from './fuelFillClassification.js';

const MIN_DISTANCE_KM = 10;
const PLAUSIBLE_EFFICIENCY_MIN_KM_L = 2;
const PLAUSIBLE_EFFICIENCY_MAX_KM_L = 25;

export const INTERVAL_STATUS = {
  LEARNABLE: 'LEARNABLE',
  STORED_ONLY: 'STORED_ONLY',
  REJECTED: 'REJECTED',
  FLAGGED: 'FLAGGED',
};

function odometerConfidenceNumeric(confidence) {
  if (confidence === 'high') return 100;
  if (confidence === 'medium') return 70;
  if (confidence === 'low') return 40;
  return 0;
}

function worseConfidence(a, b) {
  return odometerConfidenceNumeric(a) <= odometerConfidenceNumeric(b) ? a : b;
}

/**
 * Validate a tank-to-tank interval between two refuel rows.
 *
 * @param {{
 *   previous: object,
 *   current: object,
 *   tankCapacity?: number|null,
 *   specEfficiencyKmL?: number|null,
 * }}
 */
export function validateInterval({
  previous,
  current,
  tankCapacity = null,
  specEfficiencyKmL = null,
  checkPreviousFullTank = true,
}) {
  const prevM = Number(previous?.currentMileage);
  const curM = Number(current?.currentMileage);
  const fuel = Number(current?.actualFuelLitres);

  if (!Number.isFinite(prevM) || !Number.isFinite(curM)) {
    return { status: INTERVAL_STATUS.REJECTED, reason: 'missing_mileage' };
  }
  if (!Number.isFinite(fuel) || fuel <= 0) {
    return { status: INTERVAL_STATUS.REJECTED, reason: 'missing_fuel' };
  }
  if (curM <= prevM) {
    return { status: INTERVAL_STATUS.REJECTED, reason: 'odometer_backwards' };
  }

  const distanceKm = curM - prevM;
  if (distanceKm < MIN_DISTANCE_KM) {
    return { status: INTERVAL_STATUS.STORED_ONLY, reason: 'distance_too_short', distanceKm, fuel };
  }

  const prevConf = previous?.odometerConfidenceAtCapture ?? 'unavailable';
  const curConf = current?.odometerConfidenceAtCapture ?? 'unavailable';
  const worstConf = worseConfidence(prevConf, curConf);
  if (worstConf === 'unavailable' || worstConf === 'low') {
    return {
      status: INTERVAL_STATUS.STORED_ONLY,
      reason: 'low_odometer_confidence',
      distanceKm,
      fuel,
      odometerConfidence: worstConf,
    };
  }

  const prevDrift = previous?.odometerDriftClassAtCapture;
  const curDrift = current?.odometerDriftClassAtCapture;
  if (prevDrift === 'observation_recommended' || curDrift === 'observation_recommended') {
    return {
      status: INTERVAL_STATUS.STORED_ONLY,
      reason: 'observation_recommended',
      distanceKm,
      fuel,
    };
  }

  if (isConfirmedPartial(current)) {
    return {
      status: INTERVAL_STATUS.STORED_ONLY,
      reason: 'partial_fill',
      distanceKm,
      fuel,
    };
  }

  if (!isConfirmedFull(current)) {
    return {
      status: INTERVAL_STATUS.STORED_ONLY,
      reason: 'unclassified_fill',
      distanceKm,
      fuel,
    };
  }

  if (checkPreviousFullTank && !isConfirmedFull(previous)) {
    if (isConfirmedPartial(previous)) {
      return {
        status: INTERVAL_STATUS.STORED_ONLY,
        reason: 'previous_partial_fill',
        distanceKm,
        fuel,
        efficiencyKmL: distanceKm / fuel,
      };
    }
    return {
      status: INTERVAL_STATUS.STORED_ONLY,
      reason: 'previous_unclassified_fill',
      distanceKm,
      fuel,
      efficiencyKmL: distanceKm / fuel,
    };
  }

  const efficiencyKmL = distanceKm / fuel;
  if (efficiencyKmL < PLAUSIBLE_EFFICIENCY_MIN_KM_L || efficiencyKmL > PLAUSIBLE_EFFICIENCY_MAX_KM_L) {
    return {
      status: INTERVAL_STATUS.FLAGGED,
      reason: 'implausible_efficiency',
      distanceKm,
      fuel,
      efficiencyKmL,
    };
  }

  const cap = Number(tankCapacity);
  const spec = Number(specEfficiencyKmL);
  if (Number.isFinite(cap) && cap > 0 && Number.isFinite(spec) && spec > 0) {
    const maxDistance = cap * spec * 1.5;
    if (distanceKm > maxDistance) {
      return {
        status: INTERVAL_STATUS.FLAGGED,
        reason: 'distance_exceeds_plausible',
        distanceKm,
        fuel,
        efficiencyKmL,
      };
    }
  }

  return {
    status: INTERVAL_STATUS.LEARNABLE,
    reason: null,
    distanceKm,
    fuel,
    efficiencyKmL,
    odometerConfidence: worstConf,
  };
}

export function odometerConfidenceToNumeric(confidence) {
  return odometerConfidenceNumeric(confidence);
}
