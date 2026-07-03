import { BRIEF_STOP_MS } from './constants.js';

function toMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec} second${totalSec === 1 ? '' : 's'}`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) {
    return sec > 0 ? `${min} min ${sec}s` : `${min} minute${min === 1 ? '' : 's'}`;
  }
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hr}h ${remMin}m` : `${hr} hour${hr === 1 ? '' : 's'}`;
}

/**
 * Merge consecutive trips separated by brief stops into journey segments.
 * @param {Array<{ startTime: string, endTime?: string|null, distance?: number|null }>} trips
 * @param {{ briefStopMs?: number }} [options]
 */
export function segmentJourneys(trips = [], options = {}) {
  const briefStopMs = options.briefStopMs ?? BRIEF_STOP_MS;
  if (!trips.length) return [];

  const journeys = [];
  let current = null;

  const finishCurrent = () => {
    if (!current) return;
    const lastTrip = current.trips[current.trips.length - 1];
    current.endedAt = lastTrip.endTime ?? lastTrip.startTime;
    current.tripCount = current.trips.length;
    current.distanceM = current.trips.reduce((sum, t) => sum + (Number(t.distance) || 0), 0);
    journeys.push(current);
    current = null;
  };

  for (const trip of trips) {
    if (!current) {
      current = {
        startedAt: trip.startTime,
        trips: [trip],
        briefStops: [],
      };
      continue;
    }

    const prevTrip = current.trips[current.trips.length - 1];
    const prevEnd = toMs(prevTrip.endTime);
    const nextStart = toMs(trip.startTime);

    if (prevEnd != null && nextStart != null) {
      const gapMs = nextStart - prevEnd;
      if (gapMs >= 0 && gapMs < briefStopMs) {
        current.briefStops.push({
          at: prevTrip.endTime,
          durationMs: gapMs,
          durationLabel: formatDurationMs(gapMs),
        });
        current.trips.push(trip);
        continue;
      }
    }

    finishCurrent();
    current = {
      startedAt: trip.startTime,
      trips: [trip],
      briefStops: [],
    };
  }

  finishCurrent();
  return journeys;
}

export { formatDurationMs };
