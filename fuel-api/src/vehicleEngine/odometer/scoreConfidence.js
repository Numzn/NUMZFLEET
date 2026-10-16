/**
 * Confidence scoring (M2 §9).
 */

/**
 * @param {{
 *   odometerKm: number|null,
 *   resolutionMode: string,
 *   driftClass?: string,
 *   diagnostics: string[],
 *   hasObservation: boolean,
 * }}
 */
export function scoreConfidence({
  odometerKm,
  resolutionMode,
  driftClass,
  diagnostics = [],
  hasObservation,
}) {
  if (odometerKm == null || resolutionMode === 'unavailable') {
    return 'unavailable';
  }

  let score = 50;

  if (resolutionMode === 'anchored') score += 25;
  else if (resolutionMode === 'telemetry_only') score += 10;

  if (driftClass === 'excellent') score += 20;
  else if (driftClass === 'normal') score += 10;
  else if (driftClass === 'warning') score -= 10;
  else if (driftClass === 'observation_recommended') score -= 25;

  if (diagnostics.includes('reset_suspected')) score -= 20;
  // Graded: minutes offline -15, a day -15 more, a week -25 more. An anchored,
  // drift-free estimate is High only while telemetry is fresh (spec §9.3).
  if (diagnostics.includes('stale_telemetry')) score -= 15;
  if (diagnostics.includes('stale_telemetry_day')) score -= 15;
  if (diagnostics.includes('stale_telemetry_week')) score -= 25;
  if (diagnostics.includes('unit_mismatch_suspected')) score -= 25;
  if (diagnostics.includes('unit_unconfirmed')) score -= 10;
  // The tracker has no counter reference yet, or the anchor belongs to a different tracker: the value
  // is held, not tracked, so it cannot be trusted as a live reading.
  // A reading is being held out (a jump or reset awaiting confirmation): the figure is a hold, not a live count.
  if (diagnostics.includes('reading_quarantined')) score -= 20;
  if (diagnostics.includes('baseline_pending')) score -= 30;
  if (diagnostics.includes('anchor_device_mismatch')) score -= 30;

  if (!hasObservation) {
    score = Math.min(score, 65);
  }

  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}
