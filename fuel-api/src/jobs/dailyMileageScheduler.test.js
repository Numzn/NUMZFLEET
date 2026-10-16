import test from 'node:test';
import assert from 'node:assert/strict';

import { pastDaysToSettle, runDailyMileageSweep, runMileageHousekeeping, SETTLE_AFTER_DAY_END_MS } from './dailyMileageScheduler.js';

const none = async () => [];
const quiet = async () => ({ baselinesEstablished: 0, baselineFailures: 0, ingest: { trackers: 0, bootstrapped: 0, ingested: 0, positions: 0, failed: 0 }, relinks: { attempted: 0, synced: 0, failed: 0 } });

test('sweeps every actively assigned vehicle exactly once (dedup)', async () => {
  const computed = [];
  const stats = await runDailyMileageSweep({
    housekeeping: quiet,
    listVehicleIds: async () => ['v-1', 'v-2', 'v-2', 'v-3'],
    listUnsettled: none,
    compute: async ({ vehicleId }) => { computed.push(vehicleId); },
  });
  assert.deepEqual(computed, ['v-1', 'v-2', 'v-3']);
  assert.deepEqual(stats, { scanned: 3, computed: 3, failed: 0, settled: 0, settleFailed: 0, housekeeping: await quiet() });
});

test('one failing vehicle does not stop the sweep', async () => {
  const computed = [];
  const stats = await runDailyMileageSweep({
    housekeeping: quiet,
    listVehicleIds: async () => ['v-1', 'v-broken', 'v-3'],
    listUnsettled: none,
    compute: async ({ vehicleId }) => {
      if (vehicleId === 'v-broken') throw new Error('device history unavailable');
      computed.push(vehicleId);
    },
  });
  assert.deepEqual(computed, ['v-1', 'v-3']);
  assert.deepEqual(stats, { scanned: 3, computed: 2, failed: 1, settled: 0, settleFailed: 0, housekeeping: await quiet() });
});

test('empty fleet is a clean no-op', async () => {
  const stats = await runDailyMileageSweep({
    housekeeping: quiet,
    listVehicleIds: async () => [],
    listUnsettled: none,
    compute: async () => { throw new Error('must not be called'); },
  });
  assert.deepEqual(stats, { scanned: 0, computed: 0, failed: 0, settled: 0, settleFailed: 0, housekeeping: await quiet() });
});

test('a finished day that was never settled is recomputed for exactly that date', async () => {
  const calls = [];
  const stats = await runDailyMileageSweep({
    housekeeping: quiet,
    listVehicleIds: async () => ['v-1'],
    listUnsettled: async () => [
      { vehicleId: 'v-1', localDate: '2026-10-09' },
      { vehicleId: 'v-1', localDate: '2026-10-08' },
    ],
    compute: async (args) => { calls.push(args); },
    now: () => new Date('2026-10-10T04:00:00Z'),
  });
  assert.deepEqual(calls, [
    { vehicleId: 'v-1' }, // today, as before
    { vehicleId: 'v-1', localDate: '2026-10-09' },
    { vehicleId: 'v-1', localDate: '2026-10-08' },
  ]);
  assert.deepEqual(stats, { scanned: 1, computed: 1, failed: 0, settled: 2, settleFailed: 0, housekeeping: await quiet() });
});

test('the unsettled lookup is asked about the injected clock', async () => {
  let asked;
  await runDailyMileageSweep({
    housekeeping: quiet,
    listVehicleIds: none,
    listUnsettled: async (at) => { asked = at; return []; },
    compute: none,
    now: () => new Date('2026-10-10T04:00:00Z'),
  });
  assert.equal(asked.toISOString(), '2026-10-10T04:00:00.000Z');
});

test('a failure settling one past day is isolated and counted separately from live failures', async () => {
  const calls = [];
  const stats = await runDailyMileageSweep({
    housekeeping: quiet,
    listVehicleIds: async () => ['v-1'],
    listUnsettled: async () => [
      { vehicleId: 'v-bad', localDate: '2026-10-09' },
      { vehicleId: 'v-ok', localDate: '2026-10-09' },
    ],
    compute: async ({ vehicleId, localDate }) => {
      if (vehicleId === 'v-bad') throw new Error('traccar down');
      calls.push([vehicleId, localDate]);
    },
  });
  assert.deepEqual(calls, [['v-1', undefined], ['v-ok', '2026-10-09']]);
  assert.deepEqual(stats, { scanned: 1, computed: 1, failed: 0, settled: 1, settleFailed: 1, housekeeping: await quiet() });
});

test('if listing unsettled days fails the live sweep still completes and the failure is reported', async () => {
  const computed = [];
  const stats = await runDailyMileageSweep({
    housekeeping: quiet,
    listVehicleIds: async () => ['v-1', 'v-2'],
    listUnsettled: async () => { throw new Error('db hiccup'); },
    compute: async ({ vehicleId }) => { computed.push(vehicleId); },
  });
  assert.deepEqual(computed, ['v-1', 'v-2']);
  assert.deepEqual(stats, { scanned: 2, computed: 2, failed: 0, settled: 0, settleFailed: 1, housekeeping: await quiet() });
});

const summary = (iso) => pastDaysToSettle(new Date(iso))
  .map((d) => [d.localDate, d.settledBefore.toISOString().replace('.000Z', 'Z')]);

test('nothing is settled in the first hours after midnight, while late positions are still arriving', () => {
  // 00:30 Lusaka on 10 Oct (22:30Z on the 9th): yesterday ended 30 min ago, before the first settle point.
  assert.deepEqual(summary('2026-10-09T22:30:00Z'), [['2026-10-08', '2026-10-09T01:00:00Z']]);
  // ...the day before yesterday has already had its first settle point.
});

test('yesterday settles 3 h after it ends', () => {
  // 03:00 Lusaka = 01:00Z.
  assert.deepEqual(summary('2026-10-10T01:00:00Z'), [
    ['2026-10-09', '2026-10-10T01:00:00Z'],
    ['2026-10-08', '2026-10-10T01:00:00Z'],
  ]);
});

test('a day gets a second settle point 27 h after it ends, to catch positions uploaded late', () => {
  const [first, second] = SETTLE_AFTER_DAY_END_MS;
  assert.equal(first, 3 * 3600_000);
  assert.equal(second, 27 * 3600_000);

  // 9 Oct ended 2026-10-09T22:00Z. Between its two settle points only the first applies...
  assert.deepEqual(summary('2026-10-10T20:00:00Z').find(([d]) => d === '2026-10-09'), ['2026-10-09', '2026-10-10T01:00:00Z']);
  // ...and from 27 h on, the later one does, so a row computed at 03:00 is recomputed once more.
  assert.deepEqual(summary('2026-10-11T01:00:00Z').find(([d]) => d === '2026-10-09'), ['2026-10-09', '2026-10-11T01:00:00Z']);
});

test('only yesterday and the day before are ever considered — older rows are frozen history', () => {
  const dates = summary('2026-10-20T12:00:00Z').map(([d]) => d);
  assert.deepEqual(dates, ['2026-10-19', '2026-10-18']);
});

test('the window always ends inside the 48 h grace period, so a settle recompute is never blocked by the freeze', () => {
  const grace = 48 * 3600_000;
  assert.ok(Math.max(...SETTLE_AFTER_DAY_END_MS) < grace);
});

test('day boundaries follow the Lusaka business day (UTC+2), not UTC', () => {
  // 23:30Z on 9 Oct is already 01:30 on the 10th in Lusaka: "yesterday" is the 9th.
  const [yesterday] = pastDaysToSettle(new Date('2026-10-10T02:00:00Z')); // 04:00 Lusaka, past the 3 h point
  assert.equal(yesterday.localDate, '2026-10-09');
  assert.equal(yesterday.dayStart.toISOString(), '2026-10-08T22:00:00.000Z');

  // At 23:30Z on the 9th it is 01:30 on the 10th, so the 9th has only just ended and is not settled yet.
  const early = pastDaysToSettle(new Date('2026-10-09T23:30:00Z')).map((d) => d.localDate);
  assert.ok(!early.includes('2026-10-09'));
});

// ---- housekeeping: completing pending baselines and retrying schedule re-links ----------------------------

const sweep = (over = {}) => runDailyMileageSweep({
  listVehicleIds: none,
  listUnsettled: none,
  compute: none,
  ...over,
});

test('housekeeping runs after the live sweep and its summary is part of the stats', async () => {
  const order = [];
  const stats = await sweep({
    listVehicleIds: async () => ['v-1'],
    compute: async () => { order.push('compute'); },
    housekeeping: async () => { order.push('housekeeping'); return { baselinesEstablished: 2, baselineFailures: 0, ingest: {}, relinks: { attempted: 1, synced: 1, failed: 0 } }; },
  });
  assert.deepEqual(order, ['compute', 'housekeeping']);
  assert.equal(stats.housekeeping.baselinesEstablished, 2);
});

test('a housekeeping failure never takes down the sweep that already ran', async () => {
  const computed = [];
  const stats = await sweep({
    listVehicleIds: async () => ['v-1', 'v-2'],
    compute: async ({ vehicleId }) => { computed.push(vehicleId); },
    housekeeping: async () => { throw new Error('traccar down'); },
  });
  assert.deepEqual(computed, ['v-1', 'v-2']);
  assert.equal(stats.computed, 2);
  assert.equal(stats.housekeeping.failed, true);
});

test('housekeeping establishes each pending baseline once and isolates failures', async () => {
  const established = [];
  const summary = await runMileageHousekeeping({
    listPendingBaselines: async () => ['v-1', 'v-bad', 'v-3', 'v-1'],
    establish: async ({ vehicleId }) => {
      if (vehicleId === 'v-bad') throw new Error('boom');
      established.push(vehicleId);
      return vehicleId === 'v-3' ? null : { id: `anchor-${vehicleId}` }; // v-3: tracker still silent
    },
    ingest: async () => ({ trackers: 0 }),
    retryRelinks: async () => ({ attempted: 0, synced: 0, failed: 0 }),
  });
  assert.deepEqual(established, ['v-1', 'v-3'], 'de-duplicated, and a failure does not stop the rest');
  assert.equal(summary.baselinesEstablished, 1, 'only an actually-completed baseline counts');
  assert.equal(summary.baselineFailures, 1);
});

test('housekeeping retries pending schedule re-links', async () => {
  const summary = await runMileageHousekeeping({
    listPendingBaselines: none,
    establish: async () => null,
    ingest: async () => ({ trackers: 0 }),
    retryRelinks: async () => ({ attempted: 3, synced: 2, failed: 1 }),
  });
  assert.deepEqual(summary.relinks, { attempted: 3, synced: 2, failed: 1 });
});

test('a failing re-link retry does not stop baselines being established', async () => {
  const established = [];
  const summary = await runMileageHousekeeping({
    listPendingBaselines: async () => ['v-1'],
    establish: async ({ vehicleId }) => { established.push(vehicleId); return { id: 'a' }; },
    ingest: async () => ({ trackers: 0 }),
    retryRelinks: async () => { throw new Error('traccar down'); },
  });
  assert.deepEqual(established, ['v-1']);
  assert.equal(summary.baselinesEstablished, 1);
  assert.equal(summary.relinks.failed, 0);
  assert.equal(summary.relinkError, 'traccar down');
});

test('housekeeping completes pending baselines BEFORE ingesting, so a baseline and its remembered counter share one reading', async () => {
  const order = [];
  await runMileageHousekeeping({
    listPendingBaselines: async () => ['v-1'],
    establish: async () => { order.push('establish'); return { id: 'a' }; },
    ingest: async () => { order.push('ingest'); return { trackers: 1 }; },
    retryRelinks: async () => { order.push('relinks'); return { attempted: 0, synced: 0, failed: 0 }; },
  });
  assert.deepEqual(order, ['establish', 'ingest', 'relinks']);
});

test('the ingest summary is part of the housekeeping result', async () => {
  const summary = await runMileageHousekeeping({
    listPendingBaselines: none,
    establish: async () => null,
    ingest: async () => ({ trackers: 4, bootstrapped: 1, ingested: 2, positions: 37, failed: 0 }),
    retryRelinks: async () => ({ attempted: 0, synced: 0, failed: 0 }),
  });
  assert.deepEqual(summary.ingest, { trackers: 4, bootstrapped: 1, ingested: 2, positions: 37, failed: 0 });
});

test('an unreachable Traccar stops the ingest but not the schedule re-link retries', async () => {
  const summary = await runMileageHousekeeping({
    listPendingBaselines: none,
    establish: async () => null,
    ingest: async () => { throw new Error('traccar down'); },
    retryRelinks: async () => ({ attempted: 2, synced: 2, failed: 0 }),
  });
  assert.equal(summary.ingestError, 'traccar down');
  assert.deepEqual(summary.relinks, { attempted: 2, synced: 2, failed: 0 });
});
