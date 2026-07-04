import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentJourneys, formatDurationMs } from './segmentJourneys.js';
import { buildActivityEngine } from './buildActivityEngine.js';

test('segmentJourneys merges trips with brief stop gap', () => {
  const trips = [
    { startTime: '2026-07-03T10:34:00.000Z', endTime: '2026-07-03T10:38:00.000Z', distance: 5000 },
    { startTime: '2026-07-03T10:38:45.000Z', endTime: '2026-07-03T10:47:00.000Z', distance: 8000 },
  ];

  const journeys = segmentJourneys(trips, { briefStopMs: 3 * 60 * 1000 });
  assert.equal(journeys.length, 1);
  assert.equal(journeys[0].trips.length, 2);
  assert.equal(journeys[0].briefStops.length, 1);
  assert.equal(journeys[0].briefStops[0].durationMs, 45 * 1000);
});

test('segmentJourneys keeps separate journeys for long parking', () => {
  const trips = [
    { startTime: '2026-07-03T08:00:00.000Z', endTime: '2026-07-03T09:00:00.000Z', distance: 10000 },
    { startTime: '2026-07-03T11:00:00.000Z', endTime: '2026-07-03T12:00:00.000Z', distance: 12000 },
  ];

  const journeys = segmentJourneys(trips, { briefStopMs: 3 * 60 * 1000 });
  assert.equal(journeys.length, 2);
});

test('formatDurationMs renders human labels', () => {
  assert.equal(formatDurationMs(45000), '45 seconds');
  assert.equal(formatDurationMs(120000), '2 minutes');
});

test('buildActivityEngine collapses brief stop into user-facing activity', () => {
  // buildActivityEngine only returns activities from "today" (isToday() compares
  // against the real current date), so fixtures must be relative to test-run time,
  // not hardcoded absolute dates — same convention as the "flags trip fragmentation"
  // test below. Relative offsets here preserve the original fixture's timing:
  // trip1 10:34-10:38, 45s brief stop, trip2 10:38:45-10:47, geofenceEnter at 10:40.
  const now = new Date();
  const iso = (msAgo) => new Date(now.getTime() - msAgo).toISOString();

  const trip1Start = 14 * 60 * 1000;
  const trip1End = 10 * 60 * 1000;
  const trip2Start = trip1End - 45 * 1000;
  const trip2End = trip2Start - (8 * 60 + 15) * 1000;
  const geofenceEnter = trip2Start - 75 * 1000;

  const rawTrips = [
    { startTime: iso(trip1Start), endTime: iso(trip1End), distance: 5000 },
    { startTime: iso(trip2Start), endTime: iso(trip2End), distance: 8000 },
  ];

  const hub = {
    config: { briefStopThresholdMs: 180000 },
    rawTrips,
    journeys: segmentJourneys(rawTrips),
    rawEvents: [
      { id: 1, type: 'deviceStopped', occurredAt: iso(trip1End), attributes: {} },
      { id: 2, type: 'deviceMoving', occurredAt: iso(trip2Start), attributes: {} },
      { id: 3, type: 'geofenceEnter', occurredAt: iso(geofenceEnter), attributes: {} },
    ],
  };

  const engine = buildActivityEngine(hub);
  const labels = engine.activities.map((a) => a.label);

  assert.ok(labels.includes('Journey started'));
  assert.ok(labels.some((l) => l.startsWith('Brief stop')));
  assert.ok(labels.includes('Entered geofence'));
  assert.equal(labels.some((l) => l === 'deviceStopped' || l === 'deviceMoving'), false);
  assert.ok(engine.collapsedBriefStops >= 1);
});

test('buildActivityEngine flags trip fragmentation', () => {
  const now = new Date();
  const mkTrip = (minsAgo) => ({
    startTime: new Date(now.getTime() - minsAgo * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() - (minsAgo - 2) * 60 * 1000).toISOString(),
    distance: 1000,
  });

  const trips = [mkTrip(25), mkTrip(20), mkTrip(15)];
  const hub = {
    config: { briefStopThresholdMs: 180000 },
    rawTrips: trips,
    journeys: segmentJourneys(trips),
    rawEvents: [],
  };

  const engine = buildActivityEngine(hub);
  assert.ok(engine.anomalies.some((a) => a.code === 'ACTIVITY_TRIP_FRAGMENTATION'));
});
