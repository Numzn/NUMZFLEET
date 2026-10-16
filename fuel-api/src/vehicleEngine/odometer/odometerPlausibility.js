/**
 * Plausibility rules for a proposed odometer observation (docs/VEHICLE_OWNED_ODOMETER.md, "Observation rules").
 *
 * An observation changes the vehicle's accepted mileage, so it is checked against what the system already
 * knows before it is allowed to. This module is pure: no I/O, no clock of its own. The rules, in order:
 *
 *   1. The value must be a finite number in [0, MAX_ODOMETER_KM]                      else reject invalid_value
 *   2. No accepted odometer yet                                                         accept first_baseline
 *   3. Within tolerance (max of 50 km and 2%) of the current accepted odometer          accept within_tolerance
 *        (attested: recorded as the new baseline; not attested: accepted but NOT recorded, no_change)
 *   4. Outside tolerance and NOT attested by a person                                   reject needs_physical_confirmation
 *   5. Outside tolerance, attested, and the current baseline is only an estimate        accept establishes_baseline
 *   6. Outside tolerance, attested, current baseline physically verified (strict):
 *        decrease beyond tolerance      -> needs a reason (>= 5 chars)  accept physical_correction_down / reject correction_requires_reason
 *        increase beyond what the vehicle could have driven since the last evidence
 *                                       -> needs a reason               accept physical_correction_up   / reject implausible_increase
 *        any other increase             -> accept physical_deviation (the tracker undercounted or was offline)
 *
 * "Attested" (confirmedPhysical) means a person states they read the value from the vehicle's dashboard.
 * Only an attestation can produce state 'physically_verified'; everything else is a 'trusted_estimate'.
 * A GPS-derived value is never physically verified.
 */

export const PLAUSIBILITY = Object.freeze({
  MAX_ODOMETER_KM: 3_000_000,
  TOLERANCE_ABS_KM: 50,
  TOLERANCE_FRACTION: 0.02,
  /** The most a road vehicle could plausibly cover in a day; matches the daily read model's ceiling. */
  MAX_KM_PER_DAY: 1500,
  MIN_REASON_LENGTH: 5,
  /** When nothing says how long the vehicle has been out of contact, assume this long. */
  UNKNOWN_ELAPSED_DAYS: 30,
});

const DAY_MS = 24 * 60 * 60 * 1000;

export function toleranceKm(referenceKm) {
  const ref = Number(referenceKm);
  const fraction = Number.isFinite(ref) && ref > 0 ? ref * PLAUSIBILITY.TOLERANCE_FRACTION : 0;
  return Math.max(PLAUSIBILITY.TOLERANCE_ABS_KM, fraction);
}

/** The largest increase over `referenceKm` that driving alone could explain in `elapsedMs`. */
export function maxPlausibleIncreaseKm(elapsedMs, referenceKm) {
  const known = Number.isFinite(elapsedMs) && elapsedMs !== null;
  const days = known
    ? Math.max(1, elapsedMs / DAY_MS)
    : PLAUSIBILITY.UNKNOWN_ELAPSED_DAYS;
  return days * PLAUSIBILITY.MAX_KM_PER_DAY + toleranceKm(referenceKm);
}

const accept = (code, state, kind, deltaKm, message, record = true) => ({ decision: 'accept', code, state, kind, deltaKm, message, record });
const reject = (code, deltaKm, message) => ({ decision: 'reject', code, state: null, kind: null, deltaKm, message, record: false });

const hasReason = (reason) => typeof reason === 'string' && reason.trim().length >= PLAUSIBILITY.MIN_REASON_LENGTH;
const fmt = (km) => Math.round(km).toLocaleString('en-US');

/**
 * @param {{
 *   proposedKm: number,
 *   currentKm: number|null,            the vehicle's accepted/resolved odometer right now (null = none yet)
 *   currentIsPhysical: boolean,        the current baseline traces to a physically verified reading on the current tracker
 *   lastEvidenceAt: number|null,       epoch ms of the latest evidence behind currentKm
 *   now: number,                       epoch ms
 *   confirmedPhysical: boolean,        a person attests this was read from the dashboard
 *   reason?: string|null,
 * }} input
 */
export function assessObservation({ proposedKm, currentKm, currentIsPhysical, lastEvidenceAt, now, confirmedPhysical, reason = null }) {
  const proposed = typeof proposedKm === 'number' ? proposedKm : Number.NaN;
  if (!Number.isFinite(proposed) || proposed < 0 || proposed > PLAUSIBILITY.MAX_ODOMETER_KM) {
    return reject(
      'invalid_value',
      null,
      `An odometer reading must be a number between 0 and ${fmt(PLAUSIBILITY.MAX_ODOMETER_KM)} km.`,
    );
  }

  const physicalState = confirmedPhysical ? 'physically_verified' : 'trusted_estimate';

  if (currentKm == null || !Number.isFinite(Number(currentKm))) {
    return accept('first_baseline', physicalState, 'observation', null, 'First odometer baseline for this vehicle.');
  }

  const current = Number(currentKm);
  const delta = proposed - current;
  const tolerance = toleranceKm(current);

  if (Math.abs(delta) <= tolerance) {
    if (!confirmedPhysical) {
      // Agreeing with the estimate teaches the system nothing. Recording it would only replace a
      // verified baseline with a weaker label, so it is accepted but not recorded.
      return accept('no_change', 'trusted_estimate', 'observation', delta, 'Reading agrees with the current odometer; nothing to change.', false);
    }
    return accept('within_tolerance', 'physically_verified', 'observation', delta, 'Reading agrees with the current odometer within tolerance.');
  }

  if (!confirmedPhysical) {
    return reject(
      'needs_physical_confirmation',
      delta,
      `${fmt(proposed)} km differs from the current odometer (${fmt(current)} km) by ${fmt(Math.abs(delta))} km. `
        + 'Only a reading confirmed from the vehicle\'s dashboard can change it by that much.',
    );
  }

  if (!currentIsPhysical) {
    return accept(
      'establishes_baseline',
      'physically_verified',
      'observation',
      delta,
      'Dashboard reading replaces an unverified estimate and becomes the vehicle\'s baseline.',
    );
  }

  if (delta < 0) {
    if (!hasReason(reason)) {
      return reject(
        'correction_requires_reason',
        delta,
        `${fmt(proposed)} km is ${fmt(-delta)} km lower than the verified odometer (${fmt(current)} km). `
          + `Lowering a verified odometer is a correction and needs a reason (at least ${PLAUSIBILITY.MIN_REASON_LENGTH} characters), `
          + 'for example an instrument cluster replacement.',
      );
    }
    return accept('physical_correction_down', 'physically_verified', 'correction', delta, 'Verified odometer corrected downwards with a recorded reason.');
  }

  const elapsedMs = lastEvidenceAt == null ? null : now - lastEvidenceAt;
  const possible = maxPlausibleIncreaseKm(elapsedMs, current);
  if (delta > possible) {
    if (!hasReason(reason)) {
      return reject(
        'implausible_increase',
        delta,
        `${fmt(proposed)} km is ${fmt(delta)} km above the current odometer, more than the vehicle could have driven `
          + `since the last evidence (about ${fmt(possible)} km). Check the digits, or explain the difference in the reason.`,
      );
    }
    return accept('physical_correction_up', 'physically_verified', 'correction', delta, 'Verified odometer raised by more than could be driven, with a recorded reason.');
  }

  return accept('physical_deviation', 'physically_verified', 'observation', delta, 'Dashboard reading is higher than the tracker accounted for; recorded as the new baseline.');
}
