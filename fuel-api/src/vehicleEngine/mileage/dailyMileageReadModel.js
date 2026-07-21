/**
 * Read model for the vehicle_daily_mileage ledger: turns a persisted row plus
 * the request-time canonical odometer into the `dailyMileage` DTO exposed on
 * merged vehicle rows.
 *
 * The ledger (dailyMileageService) is the durable truth for the day-start
 * baseline; the freshest "distance so far today" is derived live as
 * currentOdometerKm − dayStartOdometerKm using the odometer the fleet list
 * already resolved in the same request — no extra Traccar queries and no
 * second mileage system. The scheduler-persisted distanceKm is the fallback
 * when a live reading is unavailable.
 */

// A fleet vehicle cannot plausibly cover more than this in one business day.
// Diffs beyond it indicate an odometer reset/unit glitch, not real distance.
const MAX_PLAUSIBLE_DAY_KM = 1500;

function validKm(value) {
  if (value == null) return null; // Number(null) is 0 — null means unknown, not zero
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > MAX_PLAUSIBLE_DAY_KM) return null;
  return n;
}

/**
 * @param {object|null} row - vehicle_daily_mileage row (model instance or plain object) for the current business day
 * @param {number|null} currentOdometerKm - canonical odometer resolved in this request, if any
 * @returns {{ km: number|null, source: 'live'|'ledger'|null, date: string|null,
 *             dayStartKm: number|null, dayStartSource: string|null, confidence: string|null }|null}
 *          null when there is no ledger row at all (feature has no data for the day)
 */
export function buildDailyMileageDto(row, currentOdometerKm) {
  if (!row) return null;

  const dayStartKm = row.dayStartOdometerKm != null && Number.isFinite(Number(row.dayStartOdometerKm))
    ? Number(row.dayStartOdometerKm)
    : null;

  // Live diff (request-time anchored odometer − ledger day-start) is the
  // freshest reading but can only UNDERCOUNT: the anchored mode clamps
  // readings below the anchor point, never inflates them. The ledger's
  // distanceKm is telemetry-diff based (exact) but up to one scheduler sweep
  // stale. The larger of the two is therefore always the closest to truth.
  let liveKm = null;
  if (dayStartKm != null && currentOdometerKm != null && Number.isFinite(Number(currentOdometerKm))) {
    liveKm = validKm(Number(currentOdometerKm) - dayStartKm);
  }
  const ledgerKm = validKm(row.distanceKm);

  let km = null;
  let source = null;
  if (liveKm != null && (ledgerKm == null || liveKm >= ledgerKm)) {
    km = liveKm;
    source = 'live';
  } else if (ledgerKm != null) {
    km = ledgerKm;
    source = 'ledger';
  }

  return {
    km: km != null ? Number(km.toFixed(1)) : null,
    source,
    date: row.localDate ?? null,
    dayStartKm,
    dayStartSource: row.dayStartSource ?? null,
    confidence: row.latestOdometerConfidence ?? null,
  };
}

export { MAX_PLAUSIBLE_DAY_KM };
