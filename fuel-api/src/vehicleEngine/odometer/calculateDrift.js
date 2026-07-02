/**
 * Mileage drift (M1 §6 / M2 §10).
 */

const DRIFT_BANDS = [
  { max: 0.1, classification: 'excellent' },
  { max: 0.5, classification: 'normal' },
  { max: 1.0, classification: 'warning' },
];

/**
 * @param {number|null} odometerKm
 * @param {number|null} latestObservationKm
 */
export function calculateDrift(odometerKm, latestObservationKm) {
  if (odometerKm == null || latestObservationKm == null) {
    return {
      driftPct: null,
      driftClass: 'unknown',
    };
  }

  const obs = Number(latestObservationKm);
  if (!Number.isFinite(obs) || obs <= 0) {
    return { driftPct: null, driftClass: 'unknown' };
  }

  const driftPct = Math.abs(Number(odometerKm) - obs) / obs * 100;
  const rounded = Number(driftPct.toFixed(3));

  let driftClass = 'observation_recommended';
  for (const band of DRIFT_BANDS) {
    if (rounded <= band.max) {
      driftClass = band.classification;
      break;
    }
  }

  return { driftPct: rounded, driftClass };
}
