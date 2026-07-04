/**
 * Canonical odometer label for the live tracking context card.
 * NOT daily mileage — that requires a day-start baseline the backend does
 * not yet provide (separate, not-yet-built checkpoint). Labeling this
 * "Odometer" rather than "Today" avoids presenting a lifetime/anchored
 * reading as a daily distance.
 */
export function formatOdometerLabel(odometerKm) {
  if (odometerKm == null || !Number.isFinite(Number(odometerKm))) return null;
  const n = Number(odometerKm);
  if (n >= 100) return `Odometer • ${Math.round(n).toLocaleString()} km`;
  return `Odometer • ${n.toFixed(1)} km`;
}
