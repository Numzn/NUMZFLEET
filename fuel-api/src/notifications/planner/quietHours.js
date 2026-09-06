import { getFleetTimezone } from '../../config/operationConfig.js';
import {
  localDateString,
  localInstant,
  localTimeOfDayMinutes,
  addLocalDays,
} from '../../utils/businessDay.js';

/**
 * A single fleet-wide quiet-hours window, in the same FLEET_TIMEZONE every
 * other business-day/operation-lock computation already uses (see
 * operationConfig.js/businessDay.js) — there is no per-company or per-user
 * timezone actually wired up anywhere in the codebase today (companies.settings
 * documents an aspirational `timezone` key in PLATFORM_ARCHITECTURE.md, but
 * nothing reads it), so a per-company/per-user quiet-hours window would be
 * inventing a local-time assumption this codebase does not otherwise make.
 * One fleet-wide window is the smallest coherent model Phase 5 needs; a
 * genuine multi-timezone deployment is a real gap, not addressed here.
 *
 * Unset (either var absent/unparsable) or a zero-length window (start ===
 * end) means quiet hours are OFF — the default, so no existing deployment
 * changes behavior until an operator explicitly configures this.
 */
function parseHHMM(raw) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw || '').trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function getWindow() {
  const start = parseHHMM(process.env.QUIET_HOURS_START);
  const end = parseHHMM(process.env.QUIET_HOURS_END);
  if (start == null || end == null || start === end) return null;
  return { start, end };
}

/** Whether quiet hours are configured at all (independent of whether `at` falls inside it). */
export function isQuietHoursConfigured() {
  return getWindow() !== null;
}

/**
 * @param {Date} [at]
 * @returns {boolean} true when `at` (fleet local time) falls inside the
 *   configured quiet-hours window. Always false when unconfigured.
 */
export function isWithinQuietHours(at = new Date()) {
  const window = getWindow();
  if (!window) return false;
  const timeZone = getFleetTimezone();
  const t = localTimeOfDayMinutes(at, timeZone);
  const { start, end } = window;
  // Non-wrapping window (e.g. 01:00-05:00): straightforward range check.
  // Wrapping window (e.g. 22:00-07:00, crosses midnight): "inside" means at
  // or after start OR before end, not a single contiguous range in
  // minutes-since-midnight terms.
  return start < end ? (t >= start && t < end) : (t >= start || t < end);
}

/**
 * The next UTC instant (strictly after `at`) at which the quiet-hours window
 * ends — i.e. when a delayed delivery becomes due again. Returns null when
 * quiet hours are unconfigured, or when `at` is not currently inside the
 * window (callers should check isWithinQuietHours first; this does not
 * re-derive "is it currently quiet" on its own to avoid two slightly
 * different notions of "now" between the two calls).
 *
 * @param {Date} [at]
 * @returns {Date|null}
 */
export function quietHoursEndAfter(at = new Date()) {
  const window = getWindow();
  if (!window) return null;
  const timeZone = getFleetTimezone();
  const today = localDateString(at, timeZone);
  const endHour = Math.floor(window.end / 60);
  const endMinute = window.end % 60;

  let candidate = localInstant(today, endHour, endMinute, timeZone);
  if (candidate.getTime() <= at.getTime()) {
    candidate = localInstant(addLocalDays(today, 1), endHour, endMinute, timeZone);
  }
  return candidate;
}
