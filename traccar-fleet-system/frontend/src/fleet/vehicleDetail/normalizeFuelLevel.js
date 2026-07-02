/**
 * Normalize fuel level from Traccar attrs to percent (0–100). Mirrors fuel-api normalizeFuelLevel.
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
  if (value > 0 && value <= 1) pct = value * 100;
  else if (value > 1 && value <= 100) pct = value;
  else if (value === 0) pct = 0;
  else return null;

  return Math.round(Math.min(Math.max(pct, 0), 100) * 10) / 10;
}
