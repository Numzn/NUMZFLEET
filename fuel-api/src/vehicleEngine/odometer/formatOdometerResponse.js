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
    ...formatOdometerProvenance(odometerState),
  };
}

/**
 * Who vouches for the value and where its baseline stands (additive to the original four fields, which
 * every existing client reads unchanged). `odometerVerification` is 'physical' only when a person
 * confirmed a dashboard reading; GPS-derived and carried-over values are 'estimated'.
 * @param {object|null} odometerState
 */
export function formatOdometerProvenance(odometerState) {
  return {
    odometerVerification: odometerState?.verification ?? 'none',
    odometerReconciliation: odometerState?.reconciliation ?? 'none',
    odometerBaselinePending: Boolean(odometerState?.baselinePending),
    odometerReadingStatus: odometerState?.readingStatus ?? 'none',
    odometerEvidenceAt: odometerState?.evidenceAt ?? null,
    odometerAnchorObservedAt: odometerState?.anchorObservedAt
      ? new Date(odometerState.anchorObservedAt).toISOString()
      : null,
  };
}
