/**
 * Fuel model lifecycle — derived at read/simulation time from existing fields only.
 * All transition cutoffs come from injected params (chosen via backtest).
 */

export const MATURITY_STATES = {
  COLD_START: 'COLD_START',
  LEARNING: 'LEARNING',
  STABILIZING: 'STABILIZING',
  MATURE: 'MATURE',
  SHIFT_SUSPECTED: 'SHIFT_SUSPECTED',
  RECALIBRATING: 'RECALIBRATING',
};

function countRecentQuarantined(recentIntervals, windowSize) {
  const rows = (recentIntervals || []).slice(0, windowSize);
  return rows.filter((r) => r.isAnomalous === true
    || r.quarantined === true
    || r.validationStatus === 'STORED_ONLY'
    || r.validationStatus === 'FLAGGED').length;
}

function countConsecutiveQuarantined(recentIntervals) {
  let count = 0;
  for (const row of recentIntervals || []) {
    const quarantined = row.isAnomalous === true
      || row.quarantined === true
      || row.envelopeRejected === true;
    if (quarantined) count += 1;
    else break;
  }
  return count;
}

function countConsecutiveAcceptedInNewBand(recentIntervals, envelope) {
  if (!envelope?.available) return 0;
  let count = 0;
  for (const row of recentIntervals || []) {
    if (!row.accepted || row.efficiencyKmL == null) break;
    const v = Number(row.efficiencyKmL);
    if (v >= envelope.lowerBound && v <= envelope.upperBound) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

/**
 * @param {{
 *   learningState?: {
 *     totalObservations?: number,
 *     confidence?: number,
 *     efficiencyHistory?: number[],
 *     trend?: string,
 *   } | null,
 *   recentIntervals?: Array<{
 *     validationStatus?: string,
 *     isAnomalous?: boolean,
 *     quarantined?: boolean,
 *     envelopeRejected?: boolean,
 *     accepted?: boolean,
 *     efficiencyKmL?: number,
 *   }>,
 *   envelope?: { available?: boolean, lowerBound?: number, upperBound?: number } | null,
 *   params?: {
 *     coldStartMaxObs?: number,
 *     learningMaxObs?: number,
 *     stabilizingMinObs?: number,
 *     matureMinObs?: number,
 *     matureMinConfidence?: number,
 *     shiftSuspectQuarantineCount?: number,
 *     recalibratingAcceptedInBandCount?: number,
 *     recentWindow?: number,
 *   },
 * }} input
 */
export function deriveModelMaturity({
  learningState = null,
  recentIntervals = [],
  envelope = null,
  params = {},
}) {
  const obs = learningState?.totalObservations ?? 0;
  const confidence = learningState?.confidence ?? 0;
  const historyLen = (learningState?.efficiencyHistory ?? []).length;

  const coldStartMaxObs = params.coldStartMaxObs ?? 0;
  const learningMaxObs = params.learningMaxObs ?? 2;
  const stabilizingMinObs = params.stabilizingMinObs ?? 3;
  const matureMinObs = params.matureMinObs ?? 5;
  const matureMinConfidence = params.matureMinConfidence ?? 60;
  const shiftSuspectCount = params.shiftSuspectQuarantineCount ?? 2;
  const recalibratingCount = params.recalibratingAcceptedInBandCount ?? 3;
  const recentWindow = params.recentWindow ?? 10;

  const consecutiveQuarantined = countConsecutiveQuarantined(recentIntervals);
  const consecutiveAcceptedInBand = countConsecutiveAcceptedInNewBand(recentIntervals, envelope);
  const recentQuarantined = countRecentQuarantined(recentIntervals, recentWindow);

  if (consecutiveAcceptedInBand >= recalibratingCount && envelope?.available) {
    return {
      state: MATURITY_STATES.RECALIBRATING,
      signals: { obs, confidence, historyLen, consecutiveQuarantined, consecutiveAcceptedInBand, recentQuarantined },
    };
  }

  if (consecutiveQuarantined >= shiftSuspectCount) {
    return {
      state: MATURITY_STATES.SHIFT_SUSPECTED,
      signals: { obs, confidence, historyLen, consecutiveQuarantined, consecutiveAcceptedInBand, recentQuarantined },
    };
  }

  if (obs >= matureMinObs && confidence >= matureMinConfidence && historyLen >= stabilizingMinObs) {
    return {
      state: MATURITY_STATES.MATURE,
      signals: { obs, confidence, historyLen, consecutiveQuarantined, consecutiveAcceptedInBand, recentQuarantined },
    };
  }

  if (obs >= stabilizingMinObs) {
    return {
      state: MATURITY_STATES.STABILIZING,
      signals: { obs, confidence, historyLen, consecutiveQuarantined, consecutiveAcceptedInBand, recentQuarantined },
    };
  }

  if (obs > coldStartMaxObs && obs <= learningMaxObs) {
    return {
      state: MATURITY_STATES.LEARNING,
      signals: { obs, confidence, historyLen, consecutiveQuarantined, consecutiveAcceptedInBand, recentQuarantined },
    };
  }

  if (obs <= coldStartMaxObs) {
    return {
      state: MATURITY_STATES.COLD_START,
      signals: { obs, confidence, historyLen, consecutiveQuarantined, consecutiveAcceptedInBand, recentQuarantined },
    };
  }

  return {
    state: MATURITY_STATES.LEARNING,
    signals: { obs, confidence, historyLen, consecutiveQuarantined, consecutiveAcceptedInBand, recentQuarantined },
  };
}

export default { deriveModelMaturity, MATURITY_STATES };
