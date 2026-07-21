/**
 * Distance insight for MapView vehicle cards.
 *
 * Preferred: Daily Mileage — distance travelled during the current business
 * day, from the fuel-api daily-mileage ledger (`display.dailyMileage.km`).
 * Fallback: canonical odometer (fuel-api resolveOdometerKm) labeled
 * "Odometer", never "Daily Mileage", so a lifetime reading is never presented
 * as a daily distance when the day's baseline is unavailable.
 */

export function formatDailyMileageLabel(dailyMileage) {
  const km = dailyMileage?.km;
  if (km == null || !Number.isFinite(Number(km))) return null;
  return `Daily Mileage • ${Number(km).toFixed(1)} km`;
}

export function formatOdometerLabel(odometerKm) {
  if (odometerKm == null || !Number.isFinite(Number(odometerKm))) return null;
  const n = Number(odometerKm);
  if (n >= 100) return `Odometer • ${Math.round(n).toLocaleString()} km`;
  return `Odometer • ${n.toFixed(1)} km`;
}

/** Daily mileage when known for today, otherwise the odometer fallback. */
export function formatDistanceInsight(display) {
  return formatDailyMileageLabel(display?.dailyMileage) ?? formatOdometerLabel(display?.odometerKm);
}
