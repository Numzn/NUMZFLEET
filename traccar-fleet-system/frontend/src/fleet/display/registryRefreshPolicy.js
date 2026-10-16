/**
 * When the fleet registry (and with it every card's odometer / daily mileage) should be re-fetched.
 *
 * fuel-api is the only place a trusted mileage is computed, so "live" here means: notice that a tracker
 * reported new distance, then ask fuel-api again — never derive a number from the raw counter. The raw
 * counters are used strictly as a TRIGGER (did anything move?) and are never displayed.
 *
 * No timers poll: a refresh is scheduled only by a counter change or by returning to a tab that has gone
 * stale, and a moving fleet is held to one request per MIN_REFRESH_INTERVAL_MS.
 */

/** Quiet period after a counter change, so a burst of position updates costs one request. */
export const TRIGGER_DEBOUNCE_MS = 5000;

/** Floor between two fetches no matter how many trackers are moving. */
export const MIN_REFRESH_INTERVAL_MS = 30000;

/** A tab brought back to the foreground refreshes if its data is older than this. */
export const VISIBLE_STALE_MS = 60000;

/** Counter resolution that counts as "moved": 100 m (the daily figure itself is shown to 0.1 km). */
const COUNTER_STEP_M = 100;

const counterStep = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n / COUNTER_STEP_M) : null;
};

/**
 * A string that changes exactly when some tracker's distance counter advances by a step. Compare by
 * equality; do not parse it.
 * @param {Record<string, {deviceId?: number, attributes?: object}>|null|undefined} positions
 */
export function mileageFingerprint(positions) {
  if (!positions) return '';
  const parts = [];
  Object.keys(positions)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((key) => {
      const attributes = positions[key]?.attributes;
      const total = counterStep(attributes?.totalDistance);
      const odo = counterStep(attributes?.odometer);
      if (total == null && odo == null) return;
      parts.push(`${key}:${total ?? ''}:${odo ?? ''}`);
    });
  return parts.join('|');
}

/**
 * Milliseconds to wait before the next fetch after a counter change.
 * @param {{ lastLoadedAt: number, now: number }} args
 */
export function nextRefreshDelay({ lastLoadedAt, now }) {
  const untilAllowed = (lastLoadedAt || 0) + MIN_REFRESH_INTERVAL_MS - now;
  return Math.max(TRIGGER_DEBOUNCE_MS, untilAllowed);
}

/**
 * @param {{ lastLoadedAt: number, now: number }} args
 */
export function shouldRefreshOnVisible({ lastLoadedAt, now }) {
  return now - (lastLoadedAt || 0) > VISIBLE_STALE_MS;
}
