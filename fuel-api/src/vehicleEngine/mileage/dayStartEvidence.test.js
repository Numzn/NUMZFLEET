import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDayStartOdometer } from './dayStartEvidence.js';

const MIDNIGHT = new Date('2026-10-10T22:00:00Z'); // 00:00 on 11 Oct in Africa/Lusaka (UTC+2)
const at = (offsetMs) => new Date(MIDNIGHT.getTime() + offsetMs);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const row = (fixtime, attributes) => ({ id: 1, fixtime, attributes: JSON.stringify(attributes) });
/** totalDistance is in metres in Traccar. */
const withTotalDistance = (km) => ({ totalDistance: km * 1000 });

const queriesOf = ({ before = null, after = null } = {}) => ({
  lastBefore: async () => before,
  firstAfter: async () => after,
});

const resolve = (queries, anchor = {}) => resolveDayStartOdometer({
  deviceId: 7,
  boundary: MIDNIGHT,
  anchorKm: null,
  anchorTelemetryKm: null,
  ...anchor,
  queries,
});

test('no device: nothing can be reconstructed', async () => {
  const result = await resolveDayStartOdometer({ deviceId: null, boundary: MIDNIGHT, anchorKm: null, anchorTelemetryKm: null });
  assert.equal(result.source, 'unavailable');
  assert.equal(result.telemetryKm, null);
});

test('a position within two minutes before the boundary is an exact boundary', async () => {
  const result = await resolve(queriesOf({ before: row(at(-90 * 1000), withTotalDistance(1234.5)) }));
  assert.equal(result.source, 'exact_boundary');
  assert.equal(result.telemetryKm, 1234.5);
  assert.deepEqual(result.evidenceFixtime, at(-90 * 1000));
});

test('an older position before the boundary is nearest_before', async () => {
  const result = await resolve(queriesOf({ before: row(at(-3 * HOUR), withTotalDistance(500)) }));
  assert.equal(result.source, 'nearest_before');
  assert.equal(result.telemetryKm, 500);
});

test('with nothing before the boundary the first position after it is used, and says so', async () => {
  const result = await resolve(queriesOf({ after: row(at(5 * HOUR), withTotalDistance(42)) }));
  assert.equal(result.source, 'nearest_after');
  assert.equal(result.telemetryKm, 42);
});

test('a position before the boundary wins over one after it', async () => {
  const result = await resolve(queriesOf({
    before: row(at(-HOUR), withTotalDistance(10)),
    after: row(at(HOUR), withTotalDistance(99)),
  }));
  assert.equal(result.telemetryKm, 10);
});

test('no positions at all is unavailable, never a fabricated zero', async () => {
  const result = await resolve(queriesOf());
  assert.equal(result.source, 'unavailable');
  assert.equal(result.odometerKm, null);
  assert.equal(result.telemetryKm, null);
  assert.equal(result.evidenceFixtime, null);
});

test('attributes that cannot be parsed give no telemetry rather than throwing', async () => {
  const result = await resolve(queriesOf({ before: { id: 1, fixtime: at(-HOUR), attributes: '{not json' } }));
  assert.equal(result.telemetryKm, null);
});

test('telemetry is returned raw: anchoring must not flatten a day that precedes the anchor', async () => {
  // Anchor captured when Traccar's counter read 5000 km; this day's baseline reads 4990 km.
  const result = await resolve(
    queriesOf({ before: row(at(-HOUR), withTotalDistance(4990)) }),
    { anchorKm: 60000, anchorTelemetryKm: 5000 },
  );
  assert.equal(result.telemetryKm, 4990, 'raw telemetry survives');
  assert.equal(result.odometerKm, 60000, 'while the anchored odometer clamps at the anchor (M2 §7)');
});

test('historical evidence is judged fresh as of its own time, not against today', async () => {
  // A baseline from 200 days ago: reconstructing that day must not be scored as stale telemetry.
  const longAgo = new Date(Date.now() - 200 * 24 * HOUR);
  const result = await resolveDayStartOdometer({
    deviceId: 7,
    boundary: new Date(longAgo.getTime() + 5 * MIN),
    anchorKm: 3000,
    anchorTelemetryKm: 4000,
    queries: queriesOf({ before: row(longAgo, withTotalDistance(4000)) }),
  });
  assert.equal(result.confidence, 'high');
});

test('a unit mismatch against the anchor is corrected for the baseline too', async () => {
  // odometer attribute reporting metres where kilometres are expected (x1000), anchor 54 000 km.
  const result = await resolveDayStartOdometer({
    deviceId: 7,
    boundary: MIDNIGHT,
    anchorKm: 54000,
    anchorTelemetryKm: 54000,
    queries: queriesOf({ before: row(at(-MIN), { odometer: 54_100_000 }) }),
  });
  assert.equal(result.telemetryKm, 54100);
});
