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
  const hub = {
    config: { briefStopThresholdMs: 180000 },
    rawTrips: [
      { startTime: '2026-07-03T10:34:00.000Z', endTime: '2026-07-03T10:38:00.000Z', distance: 5000 },
      { startTime: '2026-07-03T10:38:45.000Z', endTime: '2026-07-03T10:47:00.000Z', distance: 8000 },
    ],
    journeys: segmentJourneys([
      { startTime: '2026-07-03T10:34:00.000Z', endTime: '2026-07-03T10:38:00.000Z', distance: 5000 },
      { startTime: '2026-07-03T10:38:45.000Z', endTime: '2026-07-03T10:47:00.000Z', distance: 8000 },
    ]),
    rawEvents: [
      { id: 1, type: 'deviceStopped', occurredAt: '2026-07-03T10:38:00.000Z', attributes: {} },
      { id: 2, type: 'deviceMoving', occurredAt: '2026-07-03T10:38:45.000Z', attributes: {} },
      { id: 3, type: 'geofenceEnter', occurredAt: '2026-07-03T10:40:00.000Z', attributes: {} },
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
