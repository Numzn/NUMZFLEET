import { fetchActivityEvidence } from './fetchActivityEvidence.js';
import { segmentJourneys } from './segmentJourneys.js';
import { BRIEF_STOP_MS } from './constants.js';

/**
 * Hub facts — raw telemetry events and Traccar trips (no interpretation).
 * @param {number|null} deviceId
 */
export async function buildActivityHub(deviceId) {
  if (deviceId == null) {
    return {
      windowStart: null,
      windowEnd: null,
      rawEvents: [],
      rawTrips: [],
      journeys: [],
      config: { briefStopThresholdMs: BRIEF_STOP_MS },
    };
  }

  const evidence = await fetchActivityEvidence({ deviceId: Number(deviceId), windowHours: 24 });
  const journeys = segmentJourneys(evidence.trips, { briefStopMs: BRIEF_STOP_MS });

  return {
    windowStart: evidence.windowStart,
    windowEnd: evidence.windowEnd,
    rawEvents: evidence.events,
    rawTrips: evidence.trips,
    journeys,
    config: { briefStopThresholdMs: BRIEF_STOP_MS },
  };
}
