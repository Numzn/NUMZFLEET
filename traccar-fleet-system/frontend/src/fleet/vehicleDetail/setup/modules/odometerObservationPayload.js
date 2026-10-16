/**
 * What the "record dashboard reading" form sends to fuel-api.
 *
 * A reading becomes PHYSICALLY VERIFIED only when the person explicitly attests that they read it from the
 * vehicle's own odometer (`confirmedPhysical: true`). Nothing else — not a live GPS figure, not a reading the
 * system merely agrees with — is ever sent as an attestation, so the label cannot be earned by accident.
 */

const MIN_REASON_CHARS = 5;

/** @returns {boolean} true only for a finite, non-negative km AND an explicit attestation */
export function canSubmitObservation({ odometerKm, attestedFromDashboard }) {
  if (attestedFromDashboard !== true) return false;
  if (odometerKm == null || String(odometerKm).trim() === '') return false;
  const n = Number(odometerKm);
  return Number.isFinite(n) && n >= 0;
}

/**
 * @param {{ odometerKm: string|number, attestedFromDashboard?: boolean, reason?: string, source?: string }} args
 */
export function buildObservationPayload({
  odometerKm, attestedFromDashboard, reason, source = 'manual',
}) {
  const payload = {
    odometerKm: Number(odometerKm),
    source,
    confirmedPhysical: attestedFromDashboard === true,
  };
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  if (trimmed) payload.reason = trimmed;
  return payload;
}

export { MIN_REASON_CHARS };
