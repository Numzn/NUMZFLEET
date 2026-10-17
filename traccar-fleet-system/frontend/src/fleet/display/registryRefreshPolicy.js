/**
 * When the fleet registry (and with it every card's odometer / daily mileage) should be re-fetched.
 *
 * fuel-api is the only place a trusted mileage is computed, so "live" here means: notice that a tracker
 * reported new distance, then ask fuel-api again — never derive a number from the raw counter. The raw
 * counters are used strictly as a TRIGGER (did anything move?) and are never displayed.
 *
 * No timers poll while the live connection is up: a refresh is scheduled only by a counter change, a
 * reconnect, or returning to a tab that has gone stale (see mileageSignal.js and refreshScheduler.js), and a
 * moving fleet is held to one request per MIN_REFRESH_INTERVAL_MS.
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
 * Each tracker's distance-counter step ("did this vehicle move another 100 m?"), keyed by device id.
 * Only a trigger: the value is compared for equality and never displayed or converted to a distance.
 * @param {Record<string, {deviceId?: number, attributes?: object}>|null|undefined} positions
 * @returns {Map<string, string>}
 */
export function mileageStepsByDevice(positions) {
  const steps = new Map();
  if (!positions) return steps;
  Object.keys(positions).forEach((key) => {
    const attributes = positions[key]?.attributes;
    const total = counterStep(attributes?.totalDistance);
    const odo = counterStep(attributes?.odometer);
    if (total == null && odo == null) return;
    steps.set(key, `${total ?? ''}:${odo ?? ''}`);
  });
  return steps;
}

/**
 * A string that changes exactly when some tracker's distance counter advances by a step. Compare by
 * equality; do not parse it.
 * @param {Record<string, {deviceId?: number, attributes?: object}>|null|undefined} positions
 */
export function mileageFingerprint(positions) {
  return [...mileageStepsByDevice(positions).entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([key, step]) => `${key}:${step}`)
    .join('|');
}

/**
 * @param {{ lastLoadedAt: number, now: number }} args
 */
export function shouldRefreshOnVisible({ lastLoadedAt, now }) {
  return now - (lastLoadedAt || 0) > VISIBLE_STALE_MS;
}
