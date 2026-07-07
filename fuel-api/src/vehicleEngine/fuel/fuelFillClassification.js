/**
 * Authoritative fill classification semantics for refuel evidence.
 *
 * fillClassification is the source of truth for intelligence paths.
 * isFullTank is legacy compatibility only — false does NOT imply PARTIAL.
 */

export const FILL_CLASSIFICATION = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN',
};

export const ANCHOR_CLASSIFICATION_SOURCE = {
  EXPLICIT_CLASSIFICATION: 'explicit_classification',
  LEGACY_CONFIRMED_FULL: 'legacy_confirmed_full',
};

const VALID = new Set(Object.values(FILL_CLASSIFICATION));

/**
 * Normalize a raw classification value. Returns null when unsupported.
 * @param {unknown} value
 * @returns {'FULL'|'PARTIAL'|'UNKNOWN'|null}
 */
export function normalizeFillClassification(value) {
  if (value == null || value === '') return FILL_CLASSIFICATION.UNKNOWN;
  const normalized = String(value).trim().toUpperCase();
  return VALID.has(normalized) ? normalized : null;
}

/**
 * Resolve classification from an API completion payload.
 * fillClassification takes precedence; legacy isFullTank is compatibility-only.
 *
 * @param {object} payload
 * @returns {{ classification: 'FULL'|'PARTIAL'|'UNKNOWN', source: 'explicit'|'legacy_isFullTank'|'default' }}
 * @throws {Error & { statusCode?: number }} when fillClassification is invalid
 */
export function resolveFillClassificationFromPayload(payload = {}) {
  if (payload.fillClassification != null && payload.fillClassification !== '') {
    const normalized = normalizeFillClassification(payload.fillClassification);
    if (normalized == null) {
      const error = new Error('fillClassification must be FULL, PARTIAL, or UNKNOWN');
      error.statusCode = 400;
      throw error;
    }
    return { classification: normalized, source: 'explicit' };
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isFullTank')) {
    if (payload.isFullTank === true || payload.isFullTank === 'true') {
      return { classification: FILL_CLASSIFICATION.FULL, source: 'legacy_isFullTank' };
    }
    return { classification: FILL_CLASSIFICATION.UNKNOWN, source: 'legacy_isFullTank' };
  }

  const error = new Error('fillClassification is required');
  error.statusCode = 400;
  throw error;
}

/**
 * Physical sanity gate at the refuel completion boundary.
 *
 * Rule: when tank capacity is verified (a manager-entered value, not the generic
 * default fallback), actualFuelLitres can never exceed it in a single refuel event —
 * this holds for FULL, PARTIAL, and UNKNOWN alike. A tank's physical size doesn't
 * depend on whether the operator confirmed it was filled to the top, so UNKNOWN
 * gets no special pass; it is checked exactly like FULL and PARTIAL.
 *
 * When capacity is unverified/default, there is no trustworthy ceiling to enforce
 * against, so this does not reject — the existing exceeds-capacity flag (status
 * becomes 'flagged') still applies for review.
 *
 * @param {object} params
 * @param {number} params.actualFuelLitres
 * @param {number|null} params.tankCapacitySnapshot
 * @param {boolean} params.capacityVerified
 * @throws {Error & { statusCode?: number }} when a verified capacity is physically exceeded
 */
export function assertPhysicalCapacitySanity({ actualFuelLitres, tankCapacitySnapshot, capacityVerified }) {
  if (!capacityVerified) return;
  const cap = Number(tankCapacitySnapshot);
  const litres = Number(actualFuelLitres);
  if (!Number.isFinite(cap) || cap <= 0) return;
  if (Number.isFinite(litres) && litres > cap) {
    const error = new Error(
      `actualFuelLitres (${litres} L) exceeds the verified tank capacity (${cap} L)`,
    );
    error.statusCode = 400;
    throw error;
  }
}

/** @param {object|null|undefined} refuel */
export function effectiveFillClassification(refuel) {
  const raw = refuel?.fillClassification ?? refuel?.fill_classification;
  const normalized = normalizeFillClassification(raw);
  return normalized ?? FILL_CLASSIFICATION.UNKNOWN;
}

/** Operator-confirmed full tank, including legacy isFullTank=true rows. */
export function isConfirmedFull(refuel) {
  if (!refuel) return false;
  const classification = effectiveFillClassification(refuel);
  if (classification === FILL_CLASSIFICATION.FULL) return true;
  if (classification === FILL_CLASSIFICATION.UNKNOWN && refuel.isFullTank === true) {
    return true;
  }
  return false;
}

/** Operator-confirmed partial fill — never inferred from isFullTank=false. */
export function isConfirmedPartial(refuel) {
  if (!refuel) return false;
  return effectiveFillClassification(refuel) === FILL_CLASSIFICATION.PARTIAL;
}

/** Fill state was not operator-confirmed. Legacy false rows are UNKNOWN, not PARTIAL. */
export function isUnknownFill(refuel) {
  if (!refuel) return true;
  if (isConfirmedFull(refuel) || isConfirmedPartial(refuel)) return false;
  return true;
}

/**
 * Legacy boolean for schema compatibility.
 * UNKNOWN maps to false — not trusted as partial evidence.
 */
export function toLegacyIsFullTank(classification) {
  return classification === FILL_CLASSIFICATION.FULL;
}

/**
 * Provenance for anchor classification in observation metadata.
 * @returns {'explicit_classification'|'legacy_confirmed_full'|null}
 */
export function getAnchorClassificationSource(refuel) {
  if (!refuel) return null;
  const classification = effectiveFillClassification(refuel);
  if (classification === FILL_CLASSIFICATION.FULL) {
    return ANCHOR_CLASSIFICATION_SOURCE.EXPLICIT_CLASSIFICATION;
  }
  if (classification === FILL_CLASSIFICATION.UNKNOWN && refuel.isFullTank === true) {
    return ANCHOR_CLASSIFICATION_SOURCE.LEGACY_CONFIRMED_FULL;
  }
  return null;
}

/**
 * Replay event kind for Fuel State ordered replay.
 * @returns {'full'|'partial'|'unknown'}
 */
export function resolveReplayFillKind(refuel) {
  if (isConfirmedFull(refuel)) return 'full';
  if (isConfirmedPartial(refuel)) return 'partial';
  return 'unknown';
}

export default {
  FILL_CLASSIFICATION,
  ANCHOR_CLASSIFICATION_SOURCE,
  normalizeFillClassification,
  resolveFillClassificationFromPayload,
  assertPhysicalCapacitySanity,
  effectiveFillClassification,
  isConfirmedFull,
  isConfirmedPartial,
  isUnknownFill,
  toLegacyIsFullTank,
  getAnchorClassificationSource,
  resolveReplayFillKind,
};
