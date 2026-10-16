import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDailyMileage } from './dailyMileageService.js';
import { localMidnightUtc } from '../../utils/businessDay.js';

const TZ = 'Africa/Lusaka';
const NOW = new Date('2026-10-11T10:00:00Z'); // 12:00 on 11 Oct in Lusaka
const HOUR = 60 * 60 * 1000;

/** Fake collaborators: records what was persisted and which boundaries were asked for. */
const makeDeps = (overrides = {}) => {
  const calls = { upserts: [], dayStarts: [], live: [] };
  const deps = {
    now: () => NOW,
    findFrozenRow: async () => null,
    findRow: async () => null,
    findAssignment: async () => ({ deviceId: 7 }),
    findAnchor: async () => null,
    resolveDayStart: async (args) => {
      calls.dayStarts.push(args);
      return {
        odometerKm: null, source: 'exact_boundary', evidenceFixtime: new Date('2026-10-10T21:59:00Z'),
        confidence: 'medium', telemetryKm: 1000,
      };
    },
    resolveLive: async (deviceId) => {
      calls.live.push(deviceId);
      return { odometerKm: null, odometerConfidence: 'medium', telemetryKm: 1012.4 };
    },
    upsertRow: async (fields) => { calls.upserts.push(fields); return fields; },
    ...overrides,
  };
  return { deps, calls };
};

const compute = (args, deps) => computeDailyMileage({ vehicleId: 'veh-1', timeZone: TZ, ...args }, deps);

test('a vehicle with no active device assignment gets an honest unavailable row, not a zero', async () => {
  const { deps, calls } = makeDeps({ findAssignment: async () => null });
  const row = await compute({}, deps);

  assert.equal(row.dayStartSource, 'unavailable');
  assert.equal(row.distanceKm, null);
  assert.equal(row.latestOdometerConfidence, 'unavailable');
  assert.equal(calls.dayStarts.length, 0, 'no history is queried without a device');
});

test("today's distance is the live telemetry minus the reconstructed day-start telemetry", async () => {
  const { deps, calls } = makeDeps();
  const row = await compute({}, deps);

  assert.equal(row.distanceKm, 12.4);
  assert.equal(row.localDate, '2026-10-11');
  assert.deepEqual(calls.live, [7], 'today uses the live reading');
  assert.equal(calls.dayStarts.length, 1, 'and only the day-start baseline is reconstructed');
  assert.deepEqual(calls.dayStarts[0].boundary, localMidnightUtc('2026-10-11', TZ));
});

test('distance diffs raw telemetry, so a day that precedes the anchor is not flattened to zero', async () => {
  const { deps } = makeDeps({
    findAnchor: async () => ({ deviceId: 7, odometerKm: 60000, telemetryKm: 5000 }),
    // Both anchored readings clamp to the anchor (60000) ...
    resolveDayStart: async () => ({ odometerKm: 60000, source: 'exact_boundary', evidenceFixtime: NOW, confidence: 'high', telemetryKm: 4990 }),
    resolveLive: async () => ({ odometerKm: 60000, odometerConfidence: 'high', telemetryKm: 4998.5 }),
  });
  const row = await compute({}, deps);
  // ... yet the real distance travelled is the telemetry difference.
  assert.equal(row.distanceKm, 8.5);
});

test('the anchor is handed to the baseline reconstruction', async () => {
  const { deps, calls } = makeDeps({ findAnchor: async () => ({ deviceId: 7, odometerKm: 54321, telemetryKm: 4000 }) });
  await compute({}, deps);
  assert.equal(calls.dayStarts[0].anchorKm, 54321);
  assert.equal(calls.dayStarts[0].anchorTelemetryKm, 4000);
});

test('the anchor is the VEHICLE\'s: it is looked up by vehicle, not by tracker', async () => {
  let asked;
  const { deps } = makeDeps({ findAnchor: async (vehicleId) => { asked = vehicleId; return null; } });
  await compute({}, deps);
  assert.equal(asked, 'veh-1');
});

test('an anchor taken on a different tracker contributes its mileage but not its counter reference', async () => {
  const { deps, calls } = makeDeps({ findAnchor: async () => ({ deviceId: 3, odometerKm: 54321, telemetryKm: 4000 }) });
  await compute({}, deps); // the vehicle's current tracker is device 7
  assert.equal(calls.dayStarts[0].anchorKm, 54321);
  assert.equal(calls.dayStarts[0].anchorTelemetryKm, null, 'tracker 3\'s counter says nothing about tracker 7');
});

test('a pending baseline passes no counter reference either', async () => {
  const { deps, calls } = makeDeps({ findAnchor: async () => ({ deviceId: 7, odometerKm: 54321, telemetryKm: null }) });
  await compute({}, deps);
  assert.equal(calls.dayStarts[0].anchorTelemetryKm, null);
});

test('falls back to the anchored odometer diff when telemetry is missing on a side', async () => {
  const { deps } = makeDeps({
    resolveDayStart: async () => ({ odometerKm: 54000, source: 'nearest_before', evidenceFixtime: NOW, confidence: 'high', telemetryKm: null }),
    resolveLive: async () => ({ odometerKm: 54015.2, odometerConfidence: 'high', telemetryKm: null }),
  });
  assert.equal((await compute({}, deps)).distanceKm, 15.2);
});

test('an unknown baseline gives unknown distance — null, never 0', async () => {
  const { deps } = makeDeps({
    resolveDayStart: async () => ({ odometerKm: null, source: 'unavailable', evidenceFixtime: null, confidence: 'unavailable', telemetryKm: null }),
  });
  const row = await compute({}, deps);
  assert.equal(row.distanceKm, null);
  assert.equal(row.dayStartSource, 'unavailable');
});

test('a vehicle that did not move has a real distance of 0, which is not "unknown"', async () => {
  const { deps } = makeDeps({
    resolveLive: async () => ({ odometerKm: null, odometerConfidence: 'medium', telemetryKm: 1000 }),
  });
  assert.equal((await compute({}, deps)).distanceKm, 0);
});

test('a negative difference (counter reset, out-of-order arrival) is stored as unknown, not as a negative distance', async () => {
  const { deps } = makeDeps({
    resolveLive: async () => ({ odometerKm: null, odometerConfidence: 'low', telemetryKm: 990 }),
  });
  assert.equal((await compute({}, deps)).distanceKm, null);
});

test("a past day is bounded by THAT day's end, never by today's live odometer", async () => {
  const { deps, calls } = makeDeps();
  await compute({ localDate: '2026-10-09' }, deps);

  assert.deepEqual(calls.live, [], 'the live reading is not consulted');
  assert.equal(calls.dayStarts.length, 2);
  const [start, end] = calls.dayStarts.map((c) => c.boundary.getTime());
  assert.equal(start, localMidnightUtc('2026-10-09', TZ).getTime());
  assert.equal(end - start, 24 * HOUR);
});

test('a frozen row is returned untouched and nothing is recomputed or written', async () => {
  const frozen = { vehicleId: 'veh-1', localDate: '2026-10-01', distanceKm: 41.2 };
  const { deps, calls } = makeDeps({ findFrozenRow: async () => frozen });
  const row = await compute({ localDate: '2026-10-01' }, deps);

  assert.equal(row, frozen);
  assert.equal(calls.upserts.length, 0);
  assert.equal(calls.dayStarts.length, 0);
});

test('the clock is asked once, and the row records when it was computed', async () => {
  const { deps } = makeDeps();
  const row = await compute({}, deps);
  assert.deepEqual(row.latestCapturedAt, NOW);
});

// ---- a finished day's real measurement is never replaced by "unknown"

const PAST = '2026-10-09';
const unknownDay = {
  resolveDayStart: async () => ({ odometerKm: null, source: 'unavailable', evidenceFixtime: null, confidence: 'unavailable', telemetryKm: null }),
};

test('settling a finished day keeps its real distance when the recompute finds no history', async () => {
  const stored = { vehicleId: 'veh-1', localDate: PAST, distanceKm: 41.2 };
  const { deps, calls } = makeDeps({ ...unknownDay, findRow: async () => stored });
  const row = await compute({ localDate: PAST }, deps);

  assert.equal(row, stored);
  assert.equal(calls.upserts.length, 0, 'nothing is written over the real measurement');
});

test('...and when the tracker has since been unassigned', async () => {
  const stored = { vehicleId: 'veh-1', localDate: PAST, distanceKm: 41.2 };
  const { deps, calls } = makeDeps({ findAssignment: async () => null, findRow: async () => stored });
  const row = await compute({ localDate: PAST }, deps);

  assert.equal(row, stored);
  assert.equal(calls.upserts.length, 0);
});

test('...and when the recompute produces a negative (counter glitch) difference', async () => {
  const stored = { vehicleId: 'veh-1', localDate: PAST, distanceKm: 18.0 };
  const { deps, calls } = makeDeps({
    findRow: async () => stored,
    resolveDayStart: async ({ boundary }) => ({
      odometerKm: null, source: 'exact_boundary', evidenceFixtime: boundary, confidence: 'medium',
      telemetryKm: boundary.getTime() === localMidnightUtc(PAST, TZ).getTime() ? 1000 : 990, // day end < day start
    }),
  });
  assert.equal(await compute({ localDate: PAST }, deps), stored);
  assert.equal(calls.upserts.length, 0);
});

test('a recompute that does resolve replaces the earlier figure — that is the point of settling', async () => {
  const stored = { vehicleId: 'veh-1', localDate: PAST, distanceKm: 18.0 }; // last sweep before midnight
  const { deps, calls } = makeDeps({
    findRow: async () => stored,
    resolveDayStart: async ({ boundary }) => ({
      odometerKm: null, source: 'exact_boundary', evidenceFixtime: boundary, confidence: 'medium',
      telemetryKm: boundary.getTime() === localMidnightUtc(PAST, TZ).getTime() ? 1000 : 1023.4,
    }),
  });
  const row = await compute({ localDate: PAST }, deps);

  assert.equal(row.distanceKm, 23.4);
  assert.equal(calls.upserts.length, 1);
});

test('a past row that never resolved is still written — only real measurements are protected', async () => {
  const { deps, calls } = makeDeps({ ...unknownDay, findRow: async () => ({ distanceKm: null }) });
  const row = await compute({ localDate: PAST }, deps);

  assert.equal(row.dayStartSource, 'unavailable');
  assert.equal(calls.upserts.length, 1);
});

test("today's row is protected too: an unresolved recompute never replaces a real distance", async () => {
  const stored = { vehicleId: 'veh-1', localDate: '2026-10-11', distanceKm: 12.4 };
  const { deps, calls } = makeDeps({ ...unknownDay, findRow: async () => stored });
  const row = await compute({}, deps);

  assert.equal(row, stored);
  assert.equal(calls.upserts.length, 0, 'the earlier real measurement is left untouched');
});

test("...including when today's tracker has just been unassigned", async () => {
  const stored = { vehicleId: 'veh-1', localDate: '2026-10-11', distanceKm: 12.4 };
  const { deps, calls } = makeDeps({ findAssignment: async () => null, findRow: async () => stored });
  assert.equal(await compute({}, deps), stored);
  assert.equal(calls.upserts.length, 0);
});

test("today's row with no real distance yet is still written, so the day gets its first record", async () => {
  const { deps, calls } = makeDeps({ ...unknownDay, findRow: async () => ({ distanceKm: null }) });
  const row = await compute({}, deps);
  assert.equal(row.dayStartSource, 'unavailable');
  assert.equal(calls.upserts.length, 1);
});

test("today's live recompute that DOES resolve replaces the stored figure (the day keeps growing)", async () => {
  const { deps, calls } = makeDeps({ findRow: async () => ({ distanceKm: 3.1 }) });
  const row = await compute({}, deps);
  assert.equal(row.distanceKm, 12.4);
  assert.equal(calls.upserts.length, 1);
});

test('the default day is "today" in the SAME timezone the caller asked for', async () => {
  // 23:30Z on 11 Oct is already the 12th in Lusaka but still the 11th in UTC.
  const lateUtc = new Date('2026-10-11T23:30:00Z');
  const utc = makeDeps({ now: () => lateUtc });
  assert.equal((await computeDailyMileage({ vehicleId: 'veh-1', timeZone: 'UTC' }, utc.deps)).localDate, '2026-10-11');
  const lusaka = makeDeps({ now: () => lateUtc });
  assert.equal((await computeDailyMileage({ vehicleId: 'veh-1' }, lusaka.deps)).localDate, '2026-10-12');
});

// ---- days built from accepted readings are never overwritten by the legacy raw difference ------------------

test('an accepted day is returned as it is: the raw-difference method does not touch it', async () => {
  const acceptedRow = { vehicleId: 'veh-1', localDate: '2026-10-11', evidence: 'accepted', confirmedKm: 7.5, distanceKm: 7.5 };
  const { deps, calls } = makeDeps({ findRow: async () => acceptedRow });
  const row = await compute({}, deps);

  assert.equal(row, acceptedRow);
  assert.equal(calls.upserts.length, 0);
  assert.equal(calls.dayStarts.length, 0, 'no history is even queried');
  assert.deepEqual(calls.live, []);
});

test('a legacy day is still computed by the raw-difference method', async () => {
  const { deps, calls } = makeDeps({ findRow: async () => ({ evidence: 'legacy', distanceKm: 3 }) });
  const row = await compute({}, deps);
  assert.equal(row.distanceKm, 12.4);
  assert.equal(calls.upserts.length, 1);
});
