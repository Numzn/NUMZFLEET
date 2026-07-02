/**
 * Normalize fuel level from Traccar position attributes to percent (0–100).
 * Accepts fraction (0..1) or percent (1..100).
 *
 * @param {Record<string, unknown>|null|undefined} attrs
 * @returns {number|null}
 */
export function normalizeFuelLevelFromAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object') return null;

  const raw = attrs.fuel ?? attrs.fuelLevel ?? attrs.fuel1 ?? attrs.fuel_level;
  if (raw == null || raw === '') return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) return null;

  let pct;
  if (value > 0 && value <= 1) {
    pct = value * 100;
  } else if (value > 1 && value <= 100) {
    pct = value;
  } else if (value === 0) {
    pct = 0;
  } else {
    return null;
  }

  return Math.round(Math.min(Math.max(pct, 0), 100) * 10) / 10;
}

/**
 * @param {number|null|undefined} value — fraction or percent
 * @returns {number|null} percent 0–100
 */
export function normalizeFuelLevelValue(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  let pct;
  if (n > 0 && n <= 1) pct = n * 100;
  else if (n > 1 && n <= 100) pct = n;
  else if (n === 0) pct = 0;
  else return null;

  return Math.round(Math.min(Math.max(pct, 0), 100) * 10) / 10;
}
