/**
 * Litres needed to fill the tank from the current level.
 * Formula: tankCapacity - (tankCapacity * tankLevel) with tankLevel as fraction full (0..1).
 * Equivalent: (1 - level) * capacity.
 */

function clampFraction(level) {
  if (!Number.isFinite(Number(level))) return null;
  return Math.min(Math.max(Number(level), 0), 1);
}

/**
 * @param {number} tankCapacityLitres
 * @param {number|null|undefined} tankLevelFraction — 0 empty, 1 full (or 0..100 accepted, normalized)
 */
export function estimateFuelLitres({ tankCapacity, tankLevelFraction }) {
  const capacity = Number(tankCapacity);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return 0;
  }

  let level = tankLevelFraction;
  if (Number.isFinite(level) && level > 1 && level <= 100) {
    level = level / 100;
  }
  const frac = clampFraction(level);
  if (frac == null) {
    return Number(capacity.toFixed(2));
  }

  const litresToFull = capacity - capacity * frac;
  return Number(Math.max(litresToFull, 0).toFixed(2));
}

/** Explicit business form: capacity minus (capacity * level). */
export function estimatedLitresToFill({ tankCapacityLitres, tankLevelFraction }) {
  return estimateFuelLitres({
    tankCapacity: tankCapacityLitres,
    tankLevelFraction,
  });
}
