/**
 * Shared odometer response fields for GET /odometer and registry builder parity.
 * @param {object|null} odometerState
 */
export function formatOdometerResponse(odometerState) {
  return {
    odometerKm: odometerState?.odometerKm ?? null,
    odometerConfidence: odometerState?.odometerConfidence ?? 'unavailable',
    odometerDriftPct: odometerState?.odometerDriftPct ?? null,
    odometerDriftClass: odometerState?.odometerDriftClass ?? 'unknown',
  };
}
