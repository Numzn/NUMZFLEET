/**
 * Chronological refuel pairing for fuel learning (fixes wrong-pair fallback #8).
 */

/**
 * Sort completed refuels oldest-first and return the immediate predecessor of `currentRefuelId`.
 *
 * @param {object[]} refuelRows — completed refuels (any order)
 * @param {number} currentRefuelId
 */
export function resolveChronologicalPreviousRefuel(refuelRows, currentRefuelId) {
  if (!refuelRows?.length || currentRefuelId == null) return null;

  const sorted = [...refuelRows].sort(
    (a, b) => new Date(a.sessionDate || a.createdAt) - new Date(b.sessionDate || b.createdAt),
  );

  const curIdx = sorted.findIndex((r) => Number(r.id) === Number(currentRefuelId));
  if (curIdx <= 0) return null;
  return sorted[curIdx - 1];
}

export default { resolveChronologicalPreviousRefuel };
