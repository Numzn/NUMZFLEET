/**
 * Africa/Lusaka business-day boundary helpers. Zambia is UTC+2 year-round
 * (CAT, no DST), but this computes the actual offset via Intl rather than
 * hardcoding +2h, so it stays correct if that ever changes.
 */

export const DEFAULT_BUSINESS_TIMEZONE = 'Africa/Lusaka';

/** 'YYYY-MM-DD' calendar date string for `at` in `timeZone`. */
export function localDateString(at = new Date(), timeZone = DEFAULT_BUSINESS_TIMEZONE) {
  const d = at instanceof Date ? at : new Date(at);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Exported for other timezone-aware callers (e.g. notifications/planner/quietHours.js) that need the same DST-safe offset, not just the day-boundary helpers below. */
export function timeZoneOffsetMinutes(at, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return (asUtc - at.getTime()) / 60000;
}

/**
 * UTC instant corresponding to a specific local wall-clock time (`hour`:
 * `minute`, 24h) of `localDate` ('YYYY-MM-DD') in `timeZone`.
 */
export function localInstant(localDate, hour, minute, timeZone = DEFAULT_BUSINESS_TIMEZONE) {
  const [year, month, day] = localDate.split('-').map(Number);
  const naiveUtcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = timeZoneOffsetMinutes(naiveUtcGuess, timeZone);
  return new Date(naiveUtcGuess.getTime() - offsetMinutes * 60000);
}

/**
 * UTC instant corresponding to local midnight (00:00:00) of `localDate`
 * ('YYYY-MM-DD') in `timeZone`.
 */
export function localMidnightUtc(localDate, timeZone = DEFAULT_BUSINESS_TIMEZONE) {
  return localInstant(localDate, 0, 0, timeZone);
}

/** Minutes since local midnight (0-1439) for `at` in `timeZone`. */
export function localTimeOfDayMinutes(at = new Date(), timeZone = DEFAULT_BUSINESS_TIMEZONE) {
  const d = at instanceof Date ? at : new Date(at);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** `localDate` ('YYYY-MM-DD') plus `days` calendar days — pure date arithmetic, no timezone involved. */
export function addLocalDays(localDate, days) {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
