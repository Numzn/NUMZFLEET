/**
 * Ingesting tracker positions into the remembered accepted state, the event log and the daily ledger.
 * Real database; only Traccar's position source is faked.
 *
 * Times are UTC; Africa/Lusaka is UTC+2, so a local day runs from 22:00Z to 22:00Z.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  Company, Vehicle, DeviceAssignment, TrackerCounterState, MileageReadingEvent,
  VehicleDailyMileage, VehicleMileageGap,
} from '../../models/index.js';
import { ingestTracker, reconcileTracker, dropTrackerState } from './acceptedReadingsService.js';

const companies = [];
after(async () => {
  const vehicles = await Vehicle.findAll({ where: { companyId: { [Op.in]: companies } }, attributes: ['id'] });
  const ids = vehicles.map((v) => v.id);
  if (ids.length) {
    for (const M of [MileageReadingEvent, VehicleMileageGap, VehicleDailyMileage, TrackerCounterState, DeviceAssignment]) {
      await M.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    }
    await Vehicle.destroy({ where: { id: { [Op.in]: ids } } });
  }
  if (companies.length) await Company.destroy({ where: { id: { [Op.in]: companies } } });
});

let seq = 830_000 + Math.floor(Math.random() * 1000) * 10;
const nextDevice = () => { seq += 1; return seq; };
const iso = (s) => Date.parse(s);

/** A scripted Traccar: positions per device, in ARRIVAL order (ids ascend as they are added). */
function traccar() {
  const positions = new Map();
  let nextId = 1000;
  const api = {
    positions,
    fail: false,
    add(deviceId, at, totalKm, attributes = {}) {
      if (!positions.has(deviceId)) positions.set(deviceId, []);
      const row = {
        id: (nextId += 1),
        fixtime: new Date(iso(at)).toISOString(),
        attributes: { totalDistance: totalKm * 1000, ...attributes },
      };
      positions.get(deviceId).push(row);
      return row;
    },
    deps(now, extra = {}) {
      return {
        now: () => new Date(iso(now)),
        fetchLatestPosition: async (id) => (positions.get(id) ?? []).at(-1) ?? null,
        fetchPositions: async (id, { afterId, limit }) => {
          if (api.fail) throw new Error('traccar down');
          return (positions.get(id) ?? []).filter((p) => p.id > afterId).sort((a, b) => a.id - b.id).slice(0, limit);
        },
        ...extra,
      };
    },
  };
  return api;
}

async function fleet() {
  const c = await Company.create({ slug: `acc-read-${uuid().slice(0, 10)}`, name: 'Readings Co', organizationType: 'customer', status: 'active' });
  companies.push(c.id);
  const vehicle = await Vehicle.create({ name: 'ALLION', companyId: c.id });
  const deviceId = nextDevice();
  const assignment = await DeviceAssignment.create({ vehicleId: vehicle.id, deviceId, isActive: true, assignedAt: new Date('2026-10-01T00:00:00Z') });
  return { c, vehicle, deviceId, assignment };
}

/** A vehicle whose tracker was first met at `at` with counter `km` (09:50 Lusaka on the 17th by default). */
async function met({ at = '2026-10-17T07:50:00Z', km = 1000 } = {}) {
  const f = await fleet();
  const t = traccar();
  t.add(f.deviceId, at, km);
  const first = await ingestTracker({ deviceId: f.deviceId }, t.deps(at));
  assert.equal(first.status, 'bootstrapped');
  return { ...f, t };
}

const day = (vehicleId, localDate) => VehicleDailyMileage.findOne({ where: { vehicleId, localDate } });
const dayRows = (vehicleId) => VehicleDailyMileage.findAll({ where: { vehicleId }, order: [['localDate', 'ASC']] });
const events = (vehicleId, type) => MileageReadingEvent.findAll({
  where: { vehicleId, ...(type ? { type } : {}) }, order: [['created_at', 'ASC']],
});
const stateOf = (deviceId) => TrackerCounterState.findByPk(deviceId);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ''} ${a} vs ${b}`);

test('first contact bootstraps the accepted counter at the latest reading and rewrites no history', async () => {
  const f = await fleet();
  const t = traccar();
  t.add(f.deviceId, '2026-10-16T08:00:00Z', 900);
  const latest = t.add(f.deviceId, '2026-10-16T09:00:00Z', 1000);
  const result = await ingestTracker({ deviceId: f.deviceId }, t.deps('2026-10-16T09:05:00Z'));

  assert.equal(result.status, 'bootstrapped');
  const state = await stateOf(f.deviceId);
  assert.equal(state.acceptedKm, 1000, 'the displayed mileage does not change at the moment ingestion starts');
  assert.equal(state.rawKm, 1000);
  assert.equal(state.bootstrapAcceptedKm, 1000);
  assert.equal(state.appliedKm, 0);
  assert.equal(state.attribute, 'totalDistance');
  assert.equal(Number(state.positionCursor), latest.id);
  assert.equal(state.vehicleId, f.vehicle.id);
  assert.equal(await VehicleDailyMileage.count({ where: { vehicleId: f.vehicle.id } }), 0, 'earlier days are not re-attributed');
});

test('ordinary driving accumulates onto the local day; running the ingest again changes nothing', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  f.t.add(f.deviceId, '2026-10-17T08:10:00Z', 1018.5);
  const first = await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z'));
  assert.deepEqual([first.status, first.positions], ['ingested', 2]);

  const d = await day(f.vehicle.id, '2026-10-17');
  near(d.confirmedKm, 18.5);
  assert.equal(d.unattributedKm ?? 0, 0);
  assert.equal(d.evidence, 'legacy', 'the day ingestion started on keeps the previous method');
  assert.equal(d.distanceKm, null, 'and its distanceKm is not touched');
  assert.equal(new Date(d.firstReadingAt).toISOString(), '2026-10-17T08:00:00.000Z');
  assert.equal(new Date(d.lastReadingAt).toISOString(), '2026-10-17T08:10:00.000Z');
  const state = await stateOf(f.deviceId);
  near(state.acceptedKm, 1018.5);
  near(state.appliedKm, 18.5);

  const before = (await dayRows(f.vehicle.id)).map((r) => r.toJSON());
  const second = await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:35:00Z'));
  assert.equal(second.status, 'idle');
  assert.deepEqual((await dayRows(f.vehicle.id)).map((r) => r.toJSON()), before);
});

test('driving across Lusaka midnight is shared between the two days, and later days use the accepted method', async () => {
  const f = await met({ at: '2026-10-17T21:30:00Z', km: 1000 }); // 23:30 Lusaka on the 17th
  f.t.add(f.deviceId, '2026-10-17T21:50:00Z', 1010);
  f.t.add(f.deviceId, '2026-10-17T22:10:00Z', 1020); // 00:10 Lusaka on the 18th
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T22:15:00Z'));

  const d17 = await day(f.vehicle.id, '2026-10-17');
  const d18 = await day(f.vehicle.id, '2026-10-18');
  near(d17.confirmedKm, 15, 'the 17th: 10 km before 21:50Z + half of the 10 km across midnight');
  near(d18.confirmedKm, 5, 'the 18th: the other half');
  assert.equal(d17.evidence, 'legacy');
  assert.equal(d18.evidence, 'accepted');
  near(d18.distanceKm, 5, 'for an accepted day the ledger\'s distance IS the confirmed figure');
  near((await stateOf(f.deviceId)).acceptedKm - 1000, d17.confirmedKm + d18.confirmedKm);
});

test('an impossible jump is quarantined and never reaches the daily total or the accepted counter', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  f.t.add(f.deviceId, '2026-10-17T08:01:00Z', 1900);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z'));

  near((await stateOf(f.deviceId)).acceptedKm, 1010);
  near((await day(f.vehicle.id, '2026-10-17')).confirmedKm, 10, 'the 890 km did not inflate the day');
  const [quarantined] = await events(f.vehicle.id, 'quarantined');
  assert.equal(quarantined.status, 'open');
  assert.equal(quarantined.reason, 'jump');
  assert.equal(quarantined.jumpKm, 890);
  assert.ok((await stateOf(f.deviceId)).pending, 'remembered so it can be recovered from');
});

test('...and when the counter returns to its old level the spike is discarded and the quarantine closed', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  f.t.add(f.deviceId, '2026-10-17T08:01:00Z', 1900);
  f.t.add(f.deviceId, '2026-10-17T08:02:00Z', 1011);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z'));

  near((await stateOf(f.deviceId)).acceptedKm, 1011);
  near((await day(f.vehicle.id, '2026-10-17')).confirmedKm, 11);
  assert.equal((await events(f.vehicle.id, 'quarantined'))[0].status, 'resolved');
  assert.equal((await events(f.vehicle.id, 'spike_discarded')).length, 1);
  assert.equal((await stateOf(f.deviceId)).pending, null);
});

test('a counter reset is quarantined, then accepted: the mileage continues, the jump is not counted, the gap is recorded', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  f.t.add(f.deviceId, '2026-10-17T08:10:00Z', 3); // the tracker's counter restarted
  f.t.add(f.deviceId, '2026-10-17T08:20:00Z', 5);
  f.t.add(f.deviceId, '2026-10-17T08:30:00Z', 8);
  f.t.add(f.deviceId, '2026-10-17T08:40:00Z', 12);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:45:00Z'));

  const state = await stateOf(f.deviceId);
  near(state.acceptedKm, 1019, '1,010 before the reset + the 2 + 3 + 4 km driven after it');
  near((await day(f.vehicle.id, '2026-10-17')).confirmedKm, 19);
  assert.equal((await events(f.vehicle.id, 'reset_accepted')).length, 1);
  assert.equal((await events(f.vehicle.id, 'quarantined'))[0].status, 'resolved');
  const [gap] = await VehicleMileageGap.findAll({ where: { vehicleId: f.vehicle.id } });
  assert.equal(gap.kind, 'counter_reset');
  assert.equal(gap.status, 'closed_unobserved', 'the distance driven at the moment of the reset is unknown, not zero');
  assert.equal(new Date(gap.startedAt).toISOString(), '2026-10-17T08:00:00.000Z');
  assert.equal(new Date(gap.endedAt).toISOString(), '2026-10-17T08:10:00.000Z');
});

test('data that arrives late is attributed to the day it happened on, and a past day that changes is marked as revised', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z'));
  let d = await day(f.vehicle.id, '2026-10-17');
  near(d.confirmedKm, 10);
  assert.equal(d.revisionCount, 0);

  // the tracker was offline; its buffered positions for the 17th only arrive on the 18th, long after midnight
  f.t.add(f.deviceId, '2026-10-17T08:10:00Z', 1015);
  f.t.add(f.deviceId, '2026-10-17T08:20:00Z', 1022);
  f.t.add(f.deviceId, '2026-10-17T08:30:00Z', 1030);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-18T10:00:00Z'));

  d = await day(f.vehicle.id, '2026-10-17');
  near(d.confirmedKm, 30, 'the 17th now includes what it was missing');
  assert.equal(d.revisionCount, 1, 'the earlier figure was revised by new evidence');
  assert.equal(new Date(d.lastRevisedAt).toISOString(), '2026-10-18T10:00:00.000Z');
  assert.equal(await day(f.vehicle.id, '2026-10-18'), null, 'and nothing was wrongly put on the 18th');
});

test('evidence that arrives soon after midnight is routine, not a revision', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T21:50:00Z', 1010);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T21:55:00Z'));
  f.t.add(f.deviceId, '2026-10-17T21:58:00Z', 1012);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T22:30:00Z')); // 30 min after the day ended
  assert.equal((await day(f.vehicle.id, '2026-10-17')).revisionCount, 0);
});

test('distance that arrives after a long silence is kept apart: in the mileage, but UNATTRIBUTED, and the gap recorded', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1005);
  f.t.add(f.deviceId, '2026-10-17T14:30:00Z', 1135); // 6.5 hours later, 130 km further on
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T14:35:00Z'));

  const d = await day(f.vehicle.id, '2026-10-17');
  near(d.confirmedKm, 5, 'only the driving that was actually observed');
  near(d.unattributedKm, 130, 'the rest is in the cumulative mileage but cannot be placed in the day');
  near((await stateOf(f.deviceId)).acceptedKm, 1135);
  const [gap] = await VehicleMileageGap.findAll({ where: { vehicleId: f.vehicle.id } });
  assert.equal(gap.kind, 'tracker_offline');
  assert.equal(gap.status, 'closed_unobserved');
  assert.equal((await events(f.vehicle.id, 'span')).length, 1);
});

test('a long silence with no distance (a parked vehicle) records nothing', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T20:00:00Z', 1000.01);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T20:05:00Z'));
  assert.equal(await VehicleMileageGap.count({ where: { vehicleId: f.vehicle.id } }), 0);
  assert.equal((await events(f.vehicle.id, 'span')).length, 0);
});

test('concurrent ingests of one tracker count every position exactly once', async () => {
  const f = await met();
  for (let i = 1; i <= 12; i += 1) f.t.add(f.deviceId, `2026-10-17T08:${String(i * 4).padStart(2, '0')}:00Z`, 1000 + i * 2);
  const results = await Promise.allSettled([
    ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T09:00:00Z', { batchSize: 5 })),
    ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T09:00:00Z', { batchSize: 5 })),
    ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T09:00:00Z', { batchSize: 5 })),
  ]);
  assert.ok(results.every((r) => r.status === 'fulfilled'), JSON.stringify(results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message)));
  near((await stateOf(f.deviceId)).acceptedKm, 1024);
  near((await day(f.vehicle.id, '2026-10-17')).confirmedKm, 24, 'no position was applied twice');
  assert.equal((await reconcileTracker(f.deviceId)).exact, true);
});

test('a failure part-way through a batch leaves the state, the cursor and the ledger exactly as they were', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  f.t.add(f.deviceId, '2026-10-17T08:10:00Z', 1020);
  const before = (await stateOf(f.deviceId)).toJSON();

  await assert.rejects(
    () => ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z', { beforeCommit: async () => { throw new Error('disk full'); } })),
    /disk full/,
  );
  const after = (await stateOf(f.deviceId)).toJSON();
  assert.equal(after.positionCursor, before.positionCursor);
  assert.equal(after.acceptedKm, before.acceptedKm);
  assert.equal(await VehicleDailyMileage.count({ where: { vehicleId: f.vehicle.id } }), 0);

  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:31:00Z'));
  near((await day(f.vehicle.id, '2026-10-17')).confirmedKm, 20, 'the retry applied each position once');
});

test('an unreachable Traccar changes nothing and is reported', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  f.t.fail = true;
  await assert.rejects(() => ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z')), /traccar down/);
  assert.equal(await VehicleDailyMileage.count({ where: { vehicleId: f.vehicle.id } }), 0);
  f.t.fail = false;
  assert.equal((await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:31:00Z'))).status, 'ingested');
});

test('a counter locked to totalDistance is never read from another attribute', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010, { odometer: 125400 }); // both present: totalDistance is used
  f.t.positions.get(f.deviceId).push({ id: 9_000_001, fixtime: '2026-10-17T08:05:00.000Z', attributes: { odometer: 125500 } }); // only an odometer
  f.t.add(f.deviceId, '2026-10-17T08:10:00Z', 1020);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z'));
  near((await stateOf(f.deviceId)).acceptedKm, 1020, 'the odometer-only position was skipped, not read as a 124,000 km jump');
  assert.equal((await events(f.vehicle.id)).length, 0);
});

test('a tracker with no counter at all is not bootstrapped', async () => {
  const f = await fleet();
  const t = traccar();
  t.positions.set(f.deviceId, [{ id: 5, fixtime: '2026-10-17T08:00:00.000Z', attributes: { ignition: true } }]);
  assert.equal((await ingestTracker({ deviceId: f.deviceId }, t.deps('2026-10-17T08:30:00Z'))).status, 'no_counter');
  assert.equal(await stateOf(f.deviceId), null);
});

test('a tracker with no active vehicle has no state, and an old one is dropped', async () => {
  const f = await met();
  await f.assignment.update({ isActive: false, unassignedAt: new Date() });
  assert.equal((await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z'))).status, 'no_assignment');
  assert.equal(await stateOf(f.deviceId), null);
});

test('a tracker moved to another vehicle starts a new lineage; the first vehicle\'s ledger is untouched', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z'));
  const firstLedger = (await dayRows(f.vehicle.id)).map((r) => r.toJSON());

  const other = await Vehicle.create({ name: 'HILUX', companyId: f.c.id });
  await f.assignment.update({ isActive: false, unassignedAt: new Date() });
  await DeviceAssignment.create({ vehicleId: other.id, deviceId: f.deviceId, isActive: true });
  f.t.add(f.deviceId, '2026-10-17T09:00:00Z', 1050);
  const result = await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T09:05:00Z'));

  assert.equal(result.status, 'bootstrapped');
  const state = await stateOf(f.deviceId);
  assert.equal(state.vehicleId, other.id);
  assert.equal(state.acceptedKm, 1050, 'the new vehicle starts at the hand-over reading; nothing is inherited');
  assert.deepEqual((await dayRows(f.vehicle.id)).map((r) => r.toJSON()), firstLedger);
  await DeviceAssignment.destroy({ where: { vehicleId: other.id } });
  await TrackerCounterState.destroy({ where: { vehicleId: other.id } });
  await Vehicle.destroy({ where: { id: other.id } });
});

test('dropping a tracker\'s state removes only that tracker\'s state', async () => {
  const f = await met();
  await dropTrackerState(f.deviceId);
  assert.equal(await stateOf(f.deviceId), null);
  await dropTrackerState(f.deviceId); // idempotent
});

test('RECONCILIATION: after any mix of driving, spikes, resets, gaps and late data, the daily ledger adds up to the accepted counter', async () => {
  const f = await met({ km: 5000 });
  let seed = 424242;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let raw = 5000;
  let ms = iso('2026-10-17T08:00:00Z');
  for (let i = 0; i < 400; i += 1) {
    ms += (1 + Math.floor(rnd() * 12)) * 60 * 1000;
    const roll = rnd();
    if (roll < 0.86) raw += rnd() * 2.5;
    else if (roll < 0.91) raw += 400 + rnd() * 3000; // jump
    else if (roll < 0.95) raw = rnd() * 50; // reset
    else if (roll < 0.98) { ms += 7 * 60 * 60 * 1000; raw += 20 + rnd() * 100; } // long silence, with driving done in the dark
    f.t.add(f.deviceId, new Date(ms).toISOString(), Number(raw.toFixed(3)));
  }
  // ingest in awkward small batches
  for (let n = 0; n < 200; n += 1) {
    const r = await ingestTracker({ deviceId: f.deviceId }, f.t.deps(new Date(ms + 60_000).toISOString(), { batchSize: 7, maxBatches: 2 }));
    if (r.status === 'idle') break;
  }
  const state = await stateOf(f.deviceId);
  const rows = await dayRows(f.vehicle.id);
  const ledger = rows.reduce((a, r) => a + (r.confirmedKm ?? 0) + (r.unattributedKm ?? 0), 0);

  near(ledger, state.acceptedKm - state.bootstrapAcceptedKm, 'daily ledger vs accepted counter');
  near(state.appliedKm, ledger, 'applied total vs ledger');
  const report = await reconcileTracker(f.deviceId);
  assert.equal(report.exact, true);
  assert.ok(Math.abs(report.residualKm) < 1e-6);
  assert.ok(rows.length >= 2, 'the stream spans several local days');

  // the stream really was rough: this is not a reconciliation of a clean drive
  const types = new Set((await events(f.vehicle.id)).map((e) => e.type));
  for (const needed of ['quarantined', 'span']) assert.ok(types.has(needed), `expected ${needed} events, got ${[...types].join(',')}`);
  assert.ok([...types].some((t) => t === 'reset_accepted' || t === 'level_shift_accepted' || t === 'spike_discarded'), `got ${[...types].join(',')}`);
  assert.ok(rows.some((r) => r.unattributedKm > 0), 'some distance arrived across a gap');
});

test('reconciliation reports a residual when the ledger no longer matches the accepted counter', async () => {
  const f = await met();
  f.t.add(f.deviceId, '2026-10-17T08:00:00Z', 1010);
  await ingestTracker({ deviceId: f.deviceId }, f.t.deps('2026-10-17T08:30:00Z'));
  assert.equal((await reconcileTracker(f.deviceId)).exact, true);

  const d = await day(f.vehicle.id, '2026-10-17');
  await d.update({ confirmedKm: 4 }); // a ledger that lost 6 km
  const report = await reconcileTracker(f.deviceId);
  assert.equal(report.exact, false);
  near(report.residualKm, -6);
});
