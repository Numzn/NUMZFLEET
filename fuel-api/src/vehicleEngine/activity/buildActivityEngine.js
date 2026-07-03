import {
  BRIEF_STOP_MS,
  FRAGMENTATION_TRIP_COUNT,
  FRAGMENTATION_WINDOW_MS,
  MOTION_TELEMETRY_TYPES,
  OPERATIONAL_EVENT_TYPES,
} from './constants.js';
import { labelForEventType, normalizeType } from './eventLabels.js';
import { formatDurationMs } from './segmentJourneys.js';

function toMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function isToday(iso) {
  if (!iso) return false;
  try {
    return new Date(iso).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

function pushActivity(activities, entry) {
  if (!entry.occurredAt) return;
  activities.push(entry);
}

function journeyDistanceKm(journey) {
  const metres = Number(journey.distanceM);
  if (!Number.isFinite(metres) || metres <= 0) return null;
  return Math.round((metres / 1000) * 10) / 10;
}

/**
 * Build operational activities and anomaly flags from hub facts.
 * @param {object} hub
 */
export function buildActivityEngine(hub) {
  const activities = [];
  const anomalies = [];
  const journeys = hub?.journeys ?? [];
  const rawEvents = hub?.rawEvents ?? [];
  const rawTrips = hub?.rawTrips ?? [];
  const briefStopMs = hub?.config?.briefStopThresholdMs ?? BRIEF_STOP_MS;

  for (const journey of journeys) {
    pushActivity(activities, {
      id: `journey.started:${journey.startedAt}`,
      type: 'journey.started',
      occurredAt: journey.startedAt,
      label: 'Journey started',
      summary: journey.tripCount > 1 ? 'Includes brief stops' : null,
      source: 'activity_engine',
      refs: { tripCount: journey.tripCount },
    });

    for (const stop of journey.briefStops ?? []) {
      pushActivity(activities, {
        id: `journey.brief_stop:${stop.at}`,
        type: 'journey.brief_stop',
        occurredAt: stop.at,
        label: `Brief stop (${stop.durationLabel || formatDurationMs(stop.durationMs)})`,
        summary: 'Journey continued',
        source: 'activity_engine',
        refs: { durationMs: stop.durationMs },
      });
    }

    if (journey.endedAt) {
      const distanceKm = journeyDistanceKm(journey);
      pushActivity(activities, {
        id: `journey.ended:${journey.endedAt}`,
        type: journey.tripCount > 1 ? 'journey.completed' : 'journey.ended',
        occurredAt: journey.endedAt,
        label: journey.tripCount > 1 ? 'Journey completed' : 'Journey ended',
        summary: distanceKm != null ? `${distanceKm.toLocaleString()} km` : null,
        source: 'activity_engine',
        refs: {
          tripCount: journey.tripCount,
          distanceKm,
          briefStopCount: journey.briefStops?.length ?? 0,
        },
      });
    }
  }

  for (const ev of rawEvents) {
    const resolved = normalizeType(ev.type, ev.attributes);
    const lower = String(resolved).toLowerCase();

    if (MOTION_TELEMETRY_TYPES.has(lower)) continue;

    const isOperational = OPERATIONAL_EVENT_TYPES.has(lower)
      || lower === 'geofenceenter'
      || lower === 'geofenceexit';

    if (!isOperational) continue;

    pushActivity(activities, {
      id: `event:${ev.id}`,
      type: `telemetry.${lower}`,
      occurredAt: ev.occurredAt,
      label: labelForEventType(ev.type, ev.attributes),
      summary: null,
      source: 'traccar_events',
      refs: {
        traccarEventId: ev.id,
        rawType: ev.type,
      },
    });
  }

  const collapsedBriefStops = journeys.reduce((n, j) => n + (j.briefStops?.length ?? 0), 0);
  if (collapsedBriefStops > 0) {
    anomalies.push({
      code: 'ACTIVITY_BRIEF_STOPS_COLLAPSED',
      severity: 'info',
      count: collapsedBriefStops,
      text: `${collapsedBriefStops} brief stop(s) merged into journey view`,
    });
  }

  const now = Date.now();
  const recentTrips = rawTrips.filter((t) => {
    const start = toMs(t.startTime);
    return start != null && now - start <= FRAGMENTATION_WINDOW_MS;
  });

  if (recentTrips.length >= FRAGMENTATION_TRIP_COUNT) {
    anomalies.push({
      code: 'ACTIVITY_TRIP_FRAGMENTATION',
      severity: 'info',
      count: recentTrips.length,
      text: `${recentTrips.length} trips in ${Math.round(FRAGMENTATION_WINDOW_MS / 60000)} minutes — check trip detection thresholds`,
    });
  }

  const ignitionOnEvents = rawEvents.filter((e) => normalizeType(e.type, e.attributes) === 'ignitionOn');
  const ignitionOffEvents = rawEvents.filter((e) => normalizeType(e.type, e.attributes) === 'ignitionOff');
  const lastIgnitionOn = ignitionOnEvents[ignitionOnEvents.length - 1];
  const lastIgnitionOff = ignitionOffEvents[ignitionOffEvents.length - 1];

  if (lastIgnitionOn && (!lastIgnitionOff || toMs(lastIgnitionOn.occurredAt) > toMs(lastIgnitionOff.occurredAt))) {
    const ageMs = now - (toMs(lastIgnitionOn.occurredAt) ?? now);
    if (ageMs > 30 * 60 * 1000) {
      anomalies.push({
        code: 'ACTIVITY_IGNITION_INCOMPLETE',
        severity: 'info',
        text: 'Ignition on without a matching ignition off — verify tracker wiring or protocol',
      });
    }
  }

  const todayActivities = activities.filter((a) => isToday(a.occurredAt));
  todayActivities.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return {
    activities: todayActivities,
    journeyCount: journeys.length,
    tripCount: rawTrips.length,
    collapsedBriefStops,
    briefStopThresholdMs: briefStopMs,
    anomalies,
    diagnostics: {
      rawEventCount: rawEvents.length,
      motionEventCount: rawEvents.filter((e) => MOTION_TELEMETRY_TYPES.has(
        String(normalizeType(e.type, e.attributes)).toLowerCase(),
      )).length,
    },
  };
}
