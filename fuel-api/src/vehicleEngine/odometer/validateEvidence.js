/**
 * Evidence validation flags (M2 §6).
 */

const STALE_MS = 5 * 60 * 1000;

/**
 * @param {{ device?: { status?: string, lastUpdate?: string|null }|null, position?: { fixTime?: string|null }|null }}
 */
export function validateTelemetryFreshness({ device, position }) {
  const diagnostics = [];
  let stale = false;

  const lastUpdate = device?.lastUpdate ?? position?.fixTime ?? null;
  if (!lastUpdate) {
    diagnostics.push('stale_telemetry');
    stale = true;
  } else {
    const age = Date.now() - new Date(lastUpdate).getTime();
    if (age > STALE_MS && device?.status !== 'online') {
      diagnostics.push('stale_telemetry');
      stale = true;
    }
  }

  return { stale, diagnostics };
}

/**
 * @param {number|null} anchorTelemetryKm
 * @param {number|null} currentTelemetryKm
 */
export function detectResetSuspected(anchorTelemetryKm, currentTelemetryKm) {
  if (anchorTelemetryKm == null || currentTelemetryKm == null) {
    return { resetSuspected: false, diagnostics: [] };
  }
  if (currentTelemetryKm < anchorTelemetryKm) {
    return { resetSuspected: true, diagnostics: ['reset_suspected'] };
  }
  return { resetSuspected: false, diagnostics: [] };
}

const MISMATCH_RATIO_MIN = 500;
const MISMATCH_RATIO_MAX = 2000;

/**
 * Anchor-relative unit-mismatch detection (M2 §7 correction).
 *
 * Traccar's `totalDistance` is protocol-normalised to metres and never needs
 * this check. `odometer`/`mileage` are raw, device/protocol-dependent values
 * Traccar does not normalise — their unit cannot be known from magnitude
 * alone. Instead of guessing via an absolute threshold (which would corrupt
 * a genuine high-mileage vehicle), compare the reading against the verified
 * real-world anchor: a ~1000x deviation from a plausible continuation is
 * real evidence of a metres/kilometres mismatch, not a guess.
 *
 * @param {string|null} attribute
 * @param {number|null} rawKm - telemetry value, assumed km, not yet validated
 * @param {number|null} anchorKm - verified real-world odometer reading
 * @returns {{ diagnostics: string[], correctedKm: number|null }}
 */
export function detectUnitMismatch(attribute, rawKm, anchorKm) {
  if (attribute !== 'odometer' && attribute !== 'mileage') {
    return { diagnostics: [], correctedKm: rawKm };
  }
  if (rawKm == null || !Number.isFinite(rawKm)) {
    return { diagnostics: [], correctedKm: rawKm };
  }
  if (anchorKm == null || !Number.isFinite(anchorKm) || anchorKm <= 1) {
    // No trustworthy reference point — cannot prove the unit either way.
    // Do not guess: keep the raw value, flag it as unconfirmed so confidence
    // scoring can account for it.
    return { diagnostics: ['unit_unconfirmed'], correctedKm: rawKm };
  }

  const ratio = rawKm / anchorKm;
  const inverseRatio = anchorKm / rawKm;

  if (ratio >= MISMATCH_RATIO_MIN && ratio <= MISMATCH_RATIO_MAX) {
    // ~1000x too high for a plausible continuation — likely raw metres
    // reported under this attribute.
    return {
      diagnostics: ['unit_mismatch_suspected'],
      correctedKm: Number((rawKm / 1000).toFixed(1)),
    };
  }
  if (inverseRatio >= MISMATCH_RATIO_MIN && inverseRatio <= MISMATCH_RATIO_MAX) {
    // ~1000x too low — likely an already-km value divided upstream.
    return {
      diagnostics: ['unit_mismatch_suspected'],
      correctedKm: Number((rawKm * 1000).toFixed(1)),
    };
  }

  return { diagnostics: [], correctedKm: rawKm };
}
