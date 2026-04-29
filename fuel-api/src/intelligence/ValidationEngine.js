/**
 * Variance vs estimate: |percent| < 5% normal, 5–10% warning, >10% flagged.
 * Percent = (actual - estimated) / estimated * 100 when estimated > 0.
 */

const WARNING_THRESHOLD = 5;
const FLAGGED_THRESHOLD = 10;

export function computeVariance(actualFuelLitres, estimatedFuelLitres) {
  const actual = Number(actualFuelLitres);
  const estimated = Number(estimatedFuelLitres);
  const varianceLitres = Number.isFinite(actual) && Number.isFinite(estimated)
    ? Number((actual - estimated).toFixed(3))
    : null;

  if (!Number.isFinite(estimated) || estimated <= 0 || varianceLitres == null) {
    return {
      varianceLitres,
      variancePercent: null,
      status: 'normal',
    };
  }

  const variancePercent = Number(((varianceLitres / estimated) * 100).toFixed(2));
  const abs = Math.abs(variancePercent);
  let status = 'normal';
  if (abs >= FLAGGED_THRESHOLD) {
    status = 'flagged';
  } else if (abs >= WARNING_THRESHOLD) {
    status = 'warning';
  }

  return {
    varianceLitres,
    variancePercent,
    status,
  };
}

/**
 * Resolve variance status when actual exceeds tank capacity snapshot (business override).
 */
export function mergeStatusWithCapacityFlag(varianceStatus, exceedsTankCapacity) {
  if (exceedsTankCapacity) return 'flagged';
  return varianceStatus;
}

/** Validate pump readings; returns { ok, error? } */
export function validatePumpReadings({ pumpStart, pumpEnd }) {
  const hasStart = pumpStart != null && pumpStart !== '';
  const hasEnd = pumpEnd != null && pumpEnd !== '';
  if (hasStart !== hasEnd) {
    return { ok: false, error: 'Provide both pumpStart and pumpEnd, or neither' };
  }
  if (!hasStart) {
    return { ok: true };
  }
  const a = Number(pumpStart);
  const b = Number(pumpEnd);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { ok: false, error: 'Pump readings must be finite numbers' };
  }
  if (a < 0 || b < 0) {
    return { ok: false, error: 'Pump readings cannot be negative' };
  }
  if (b <= a) {
    return { ok: false, error: 'pumpEnd must be greater than pumpStart' };
  }
  return { ok: true, deltaLitres: Number((b - a).toFixed(3)) };
}

/** Real-time validation for a refuel line item (no DB). */
export function validateRefuelActualDraft({
  actualFuelLitres,
  tankCapacitySnapshot,
  pumpStart,
  pumpEnd,
}) {
  const pumpCheck = validatePumpReadings({ pumpStart, pumpEnd });
  if (!pumpCheck.ok) {
    return pumpCheck;
  }
  let actual = actualFuelLitres;
  if (pumpCheck.deltaLitres != null) {
    actual = pumpCheck.deltaLitres;
  }
  if (actual == null || actual === '') {
    return { ok: false, error: 'actualFuelLitres or pump start/end required' };
  }
  const n = Number(actual);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'actualFuelLitres must be a positive number' };
  }
  const cap = Number(tankCapacitySnapshot);
  if (Number.isFinite(cap) && cap > 0 && n > cap) {
    return { ok: true, actualLitres: n, exceedsCapacity: true };
  }
  return { ok: true, actualLitres: n, exceedsCapacity: false };
}
