import { describeOdometerStatus } from '../../../fleet/display/odometerStatus.js';

/**
 * Distance insight for MapView vehicle cards.
 *
 * Preferred: Daily Mileage — distance travelled during the current business
 * day, from the fuel-api daily-mileage ledger (`display.dailyMileage.km`).
 * Fallback: canonical odometer (fuel-api resolveOdometerKm) labeled
 * "Odometer", never "Daily Mileage", so a lifetime reading is never presented
 * as a daily distance when the day's baseline is unavailable.
 */

/**
 * The day-start baseline is the last fix at/before midnight. When the tracker
 * had no history before midnight, the baseline is the first fix AFTER it
 * (`nearest_after`), so everything driven before that fix is not counted:
 * the figure is true, but only for part of the day, and says so.
 */
const PARTIAL_DAY_SOURCES = new Set(['nearest_after']);

/**
 * Distance the odometer gained that the ledger could not place inside this day (the tracker was silent and
 * came back with a bigger counter). It is real distance, but it is NOT part of the day's figure, so it is
 * shown beside it and never summed into it.
 */
function unobservedKm(dailyMileage) {
  const n = Number(dailyMileage?.unattributedKm);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatDailyMileageLabel(dailyMileage) {
  const km = dailyMileage?.km;
  if (km == null || !Number.isFinite(Number(km))) return null;
  const caveats = [];
  if (PARTIAL_DAY_SOURCES.has(dailyMileage?.dayStartSource)) caveats.push('partial day');
  const unobserved = unobservedKm(dailyMileage);
  if (unobserved > 0) caveats.push(`+${unobserved.toFixed(1)} km unobserved`);
  const suffix = caveats.length ? ` (${caveats.join(', ')})` : '';
  return `Daily Mileage • ${Number(km).toFixed(1)} km${suffix}`;
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

/**
 * Map-card summary: the day figure (or the odometer when there is none), then the cumulative odometer with
 * who vouches for it and how old the reading behind it is. Everything comes from the backend's resolved
 * provenance — nothing is recomputed from raw counters here.
 *
 * @returns {{ primary: string|null, secondary: string|null, tone: 'ok'|'warn'|'muted', title: string }}
 */
export function formatMileageSummary(display, now = Date.now()) {
  const dailyLabel = formatDailyMileageLabel(display?.dailyMileage);
  const odometerLabel = formatOdometerLabel(display?.odometerKm);
  const status = describeOdometerStatus(display, now);

  const secondaryParts = [];
  if (dailyLabel && odometerLabel) secondaryParts.push(odometerLabel);
  if (status.state !== 'none') {
    secondaryParts.push(status.label);
    if (status.age) secondaryParts.push(status.age);
  }

  return {
    primary: dailyLabel ?? odometerLabel,
    secondary: secondaryParts.length ? secondaryParts.join(' · ') : null,
    tone: status.tone,
    title: status.details.join('\n'),
  };
}

function formatTodayShort(dailyMileage) {
  const km = dailyMileage?.km;
  if (km == null || !Number.isFinite(Number(km))) return null;
  return `Today ${Number(km).toFixed(1)} km`;
}

function formatOdometerShort(odometerKm) {
  if (odometerKm == null || !Number.isFinite(Number(odometerKm))) return null;
  const n = Number(odometerKm);
  return n >= 100 ? `Odometer ${Math.round(n).toLocaleString()} km` : `Odometer ${n.toFixed(1)} km`;
}

const STATE_FLAGS = new Set(['review', 'awaiting', 'provisional', 'calibrating']);

/**
 * Sidebar row: the compact figure it always showed, plus at most one flag when something about the value
 * needs a person's attention (a state that is not settled, distance that is unobserved, an old reading).
 * Settled, fresh values stay quiet so the list is not noisy.
 *
 * @returns {{ text: string|null, flag: string|null, title: string }}
 */
export function formatTodaySidebarLabel(display, now = Date.now()) {
  const text = formatTodayShort(display?.dailyMileage) ?? formatOdometerShort(display?.odometerKm);
  const status = describeOdometerStatus(display, now);
  const unobserved = unobservedKm(display?.dailyMileage);

  let flag = null;
  if (STATE_FLAGS.has(status.state)) flag = status.label;
  else if (unobserved > 0) flag = `+${unobserved.toFixed(1)} km unobserved`;
  else if (status.stale && status.age) flag = `Last reading ${status.age}`;
  else if (status.lowConfidence) flag = 'Low confidence';

  return { text, flag, title: status.details.join('\n') };
}
