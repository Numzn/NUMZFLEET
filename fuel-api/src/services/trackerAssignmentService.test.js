/**
 * Tracker changes: the vehicle keeps its mileage, schedules and history; a tracker never carries one
 * vehicle's baseline to another. Real database; only the Traccar reads/permission calls are faked.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  Company, Vehicle, DeviceAssignment, VehicleSpec, VehicleOdometerAnchor, VehicleMileageGap, VehicleTrackerChange, TrackerCounterState,
} from '../models/index.js';
import { recordObservation, getCurrentAnchor, establishPendingBaseline, resolveAcceptedOdometer } from '../vehicleEngine/odometer/vehicleOdometerAnchorService.js';
import {
  applyTrackerAssignment, releaseTracker, relinkMaintenance, retryPendingMaintenanceRelinks,
} from './trackerAssignmentService.js';

const companies = [];
const devices = [];
after(async () => {
  const vehicles = await Vehicle.findAll({ where: { companyId: { [Op.in]: companies } }, attributes: ['id'] });
  const ids = vehicles.map((v) => v.id);
  if (ids.length) {
    for (const M of [VehicleTrackerChange, VehicleMileageGap, TrackerCounterState, VehicleOdometerAnchor, DeviceAssignment]) {
      await M.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    }
    await Vehicle.destroy({ where: { id: { [Op.in]: ids } } });
  }
  if (devices.length) await VehicleSpec.destroy({ where: { deviceId: { [Op.in]: devices } } });
  if (companies.length) await Company.destroy({ where: { id: { [Op.in]: companies } } });
});

let seq = 820_000 + Math.floor(Math.random() * 1000) * 10;
const device = () => { seq += 1; devices.push(seq); return seq; };

const T0 = new Date('2026-10-16T10:00:00Z');
let clock = T0.getTime();
const tick = () => { clock += 60_000; return new Date(clock); };

/** Trackers' current counters (km); a missing entry means the tracker is silent. */
function world(counters = {}) {
  const links = new Map(); // deviceId -> Set(maintenanceId)  (Traccar's tc_device_maintenance)
  const calls = { link: [], unlink: [] };
  const fail = { link: false };
  // A tracker's fix time advances with its counter (30 km/h on average), so a change of a few hundred km
  // looks like the hours of driving it is. An explicit `<id>:age` pins the last report that long ago.
  const last = {};
  const fixAt = (id) => {
    if (counters[`${id}:age`] != null) return new Date(T0.getTime() - counters[`${id}:age`]).toISOString();
    const km = counters[id];
    if (!last[id]) last[id] = { km, fixMs: T0.getTime() - 5_000 };
    else if (km !== last[id].km) {
      last[id] = { km, fixMs: last[id].fixMs + Math.max(60_000, Math.abs(km - last[id].km) * 120_000) };
    }
    return new Date(last[id].fixMs).toISOString();
  };
  return {
    counters,
    links,
    calls,
    fail,
    deps: () => ({
      now: tick,
      readCounter: async (id) => (counters[id] == null ? null : {
        deviceStatus: 'online',
        deviceLastUpdate: fixAt(id),
        positionFixTime: fixAt(id),
        positionId: 7000 + Math.round(counters[id]),
        positionAttributes: { totalDistance: counters[id] * 1000 },
      }),
      readTrackerState: async (id) => TrackerCounterState.findByPk(id),
      listDeviceMaintenanceIds: async (id) => [...(links.get(id) ?? [])],
      linkMaintenance: async (id, m) => {
        if (fail.link) throw new Error('Traccar unavailable');
        calls.link.push([id, m]);
        if (!links.has(id)) links.set(id, new Set());
        links.get(id).add(m);
      },
      unlinkMaintenance: async (id, m) => { calls.unlink.push([id, m]); links.get(id)?.delete(m); },
    }),
  };
}

async function company() {
  const c = await Company.create({ slug: `track-asg-${uuid().slice(0, 10)}`, name: 'Tracker Co', organizationType: 'customer', status: 'active' });
  companies.push(c.id);
  return c;
}
const vehicleOf = (c, name = 'ALLION') => Vehicle.create({ name, companyId: c.id });
const active = (vehicleId) => DeviceAssignment.findAll({ where: { vehicleId, isActive: true } });
const current = (vehicleId) => VehicleOdometerAnchor.findAll({ where: { vehicleId, supersededAt: null } });
const gaps = (vehicleId) => VehicleMileageGap.findAll({ where: { vehicleId }, order: [['started_at', 'ASC']] });

/** What every screen would show for the vehicle right now, given the trackers' counters. */
async function shown(vehicleId, w) {
  const assignment = (await active(vehicleId))[0] ?? null;
  const counter = assignment ? await w.deps().readCounter(assignment.deviceId) : null;
  const trackerState = assignment ? await TrackerCounterState.findByPk(assignment.deviceId) : null;
  return resolveAcceptedOdometer({ anchor: await getCurrentAnchor(vehicleId), assignment, counter, trackerState });
}

/** An established vehicle: tracker `d` on it, physically verified at 125,000 with the tracker at 4,000. */
async function establishedVehicle(w) {
  const c = await company();
  const v = await vehicleOf(c);
  const d = device();
  w.counters[d] = 4000;
  await applyTrackerAssignment({ vehicleId: v.id, deviceId: d }, w.deps());
  await recordObservation({ vehicleId: v.id, odometerKm: 125000, confirmedPhysical: true, actorUserId: 7 }, w.deps());
  return { c, v, d };
}

test('replacing a tracker keeps the vehicle\'s accepted mileage and marks the new evidence provisional', async () => {
  const w = world();
  const { v, d: oldDevice } = await establishedVehicle(w);
  w.counters[oldDevice] = 4400; // 400 km driven since the reading, on the old tracker
  const newDevice = device();
  w.counters[newDevice] = 0; // a brand-new tracker starts its counter at zero

  const result = await applyTrackerAssignment({ vehicleId: v.id, deviceId: newDevice, actorUserId: 9 }, w.deps());

  const [now] = await active(v.id);
  assert.equal(now.deviceId, newDevice);
  const [anchor] = await current(v.id);
  assert.equal(anchor.kind, 'tracker_replacement');
  assert.equal(anchor.state, 'provisional', 'the relationship to the baseline is not established yet');
  assert.equal(anchor.odometerKm, 125400, '125,000 + the 400 km the old tracker counted');
  assert.equal(anchor.telemetryKm, 0);
  assert.equal(anchor.deviceId, newDevice);
  assert.equal(anchor.actorUserId, 9);
  assert.equal(anchor.previousOdometerKm, 125400);
  assert.equal(anchor.evidence.from.deviceId, oldDevice);
  assert.equal(anchor.evidence.from.counterKm, 4400);
  assert.equal(result.anchor.id, anchor.id);

  const old = await DeviceAssignment.findOne({ where: { vehicleId: v.id, deviceId: oldDevice } });
  assert.equal(old.isActive, false);
  assert.ok(old.unassignedAt, 'the old assignment period has a closed boundary');

  w.counters[newDevice] = 120; // 120 km driven on the new tracker
  assert.equal((await shown(v.id, w)).odometerKm, 125520);
});

test('a replacement tracker whose lifetime counter does not start at zero counts only from hand-over', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  w.counters[d] = 4400;
  const used = device();
  w.counters[used] = 80000; // a second-hand tracker with 80,000 km on its own counter

  await applyTrackerAssignment({ vehicleId: v.id, deviceId: used }, w.deps());
  const [anchor] = await current(v.id);
  assert.equal(anchor.odometerKm, 125400);
  assert.equal(anchor.telemetryKm, 80000);

  w.counters[used] = 80120;
  assert.equal((await shown(v.id, w)).odometerKm, 125520, 'not 80,120, and not 205,520');
});

test('the interval between the old tracker\'s last report and the new one is recorded as unobserved, not filled in', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  w.counters[d] = 4400;
  w.counters[`${d}:age`] = 3 * 60 * 60 * 1000; // the old tracker last reported 3 hours ago
  const newDevice = device();
  w.counters[newDevice] = 10;

  await applyTrackerAssignment({ vehicleId: v.id, deviceId: newDevice }, w.deps());
  const [gap] = await gaps(v.id);
  assert.equal(gap.kind, 'tracker_replacement');
  assert.equal(gap.fromDeviceId, d);
  assert.equal(gap.toDeviceId, newDevice);
  assert.equal(gap.lastOdometerKm, 125400);
  assert.equal(gap.status, 'closed_unobserved', 'closed in time, but its distance stays unknown');
  assert.ok(gap.endedAt > gap.startedAt);
  assert.equal(new Date(gap.startedAt).toISOString(), new Date(T0.getTime() - 3 * 60 * 60 * 1000).toISOString());
  const [shownNow] = [await shown(v.id, w)];
  assert.equal(shownNow.odometerKm, 125400, 'no distance is invented for the gap');
});

test('a tracker that has not reported yet leaves the baseline pending: the mileage holds and the gap stays open', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  w.counters[d] = 4400;
  const silentOne = device(); // never reported

  await applyTrackerAssignment({ vehicleId: v.id, deviceId: silentOne }, w.deps());
  const [anchor] = await current(v.id);
  assert.equal(anchor.state, 'awaiting_tracker');
  assert.equal(anchor.telemetryKm, null);
  assert.equal((await gaps(v.id))[0].status, 'open');
  assert.equal((await shown(v.id, w)).odometerKm, 125400);

  // the tracker finally reports; a counter of 5 km must not become the vehicle's mileage
  w.counters[silentOne] = 5;
  assert.equal((await shown(v.id, w)).odometerKm, 125400);

  const done = await establishPendingBaseline({ vehicleId: v.id }, w.deps());
  assert.equal(done.telemetryKm, 5);
  assert.equal(done.state, 'provisional');
  assert.equal((await gaps(v.id))[0].status, 'closed_unobserved');
  w.counters[silentOne] = 25;
  assert.equal((await shown(v.id, w)).odometerKm, 125420);
});

test('moving a tracker from vehicle A to vehicle B never gives B A\'s mileage, and A keeps its own', async () => {
  const w = world();
  const { v: a, d: shared, c } = await establishedVehicle(w);
  w.counters[shared] = 9000; // tracker has counted 5,000 km since A's reading
  const b = await vehicleOf(c, 'HILUX B');

  await applyTrackerAssignment({ vehicleId: b.id, deviceId: shared }, w.deps());

  // A: tracker gone, but the vehicle keeps its accepted mileage, held and flagged
  assert.equal((await active(a.id)).length, 0);
  const [aAnchor] = await current(a.id);
  assert.equal(aAnchor.kind, 'tracker_removal');
  assert.equal(aAnchor.odometerKm, 130000, 'A\'s own 125,000 plus the 5,000 km the tracker counted on A');
  assert.equal(aAnchor.deviceId, null);
  assert.equal((await gaps(a.id))[0].status, 'open');
  assert.equal((await shown(a.id, w)).odometerKm, 130000);

  // B: starts counting from the hand-over, with no inherited baseline
  assert.equal((await active(b.id)).length, 1);
  const [bAnchor] = await current(b.id);
  assert.equal(bAnchor.kind, 'assignment_start');
  assert.equal(bAnchor.odometerKm, 0);
  assert.equal(bAnchor.telemetryKm, 9000);
  assert.equal(bAnchor.evidence.unknownBaseline, true);
  w.counters[shared] = 9250;
  assert.equal((await shown(b.id, w)).odometerKm, 250, 'only the 250 km driven on B');
  assert.notEqual((await shown(b.id, w)).odometerKm, 125250);

  // the shared tracker's legacy spec row no longer holds A's baseline
  const spec = await VehicleSpec.findOne({ where: { deviceId: shared } });
  assert.notEqual(spec.verifiedOdometerKm, 125000);
});

test('a brand-new vehicle given a second-hand tracker counts from assignment, not from the tracker\'s lifetime', async () => {
  const w = world();
  const c = await company();
  const v = await vehicleOf(c);
  const d = device();
  w.counters[d] = 80000;
  await applyTrackerAssignment({ vehicleId: v.id, deviceId: d }, w.deps());
  w.counters[d] = 80050;
  const s = await shown(v.id, w);
  assert.equal(s.odometerKm, 50);
});

test('assigning the tracker a vehicle already has is a no-op: no new baseline, no gap, no change record', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  const before = await VehicleOdometerAnchor.count({ where: { vehicleId: v.id } });
  const changesBefore = await VehicleTrackerChange.count({ where: { vehicleId: v.id } });
  const result = await applyTrackerAssignment({ vehicleId: v.id, deviceId: d }, w.deps());
  assert.equal(result.noop, true);
  assert.equal(await VehicleOdometerAnchor.count({ where: { vehicleId: v.id } }), before);
  assert.equal(await VehicleTrackerChange.count({ where: { vehicleId: v.id } }), changesBefore);
  assert.equal((await active(v.id)).length, 1);
});

test('releasing a tracker without a replacement leaves the vehicle holding its mileage with an open gap', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  w.counters[d] = 4250;
  await releaseTracker({ deviceId: d }, w.deps());

  assert.equal((await active(v.id)).length, 0);
  const [anchor] = await current(v.id);
  assert.equal(anchor.kind, 'tracker_removal');
  assert.equal(anchor.odometerKm, 125250);
  assert.equal((await gaps(v.id))[0].kind, 'no_tracker');
  assert.equal((await gaps(v.id))[0].status, 'open');
  assert.equal(await releaseTracker({ deviceId: d }, w.deps()), null, 'releasing a free tracker does nothing');
});

test('a tracker given back after a gap closes the open gap and continues from the held mileage', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  w.counters[d] = 4250;
  await releaseTracker({ deviceId: d }, w.deps());
  const fresh = device();
  w.counters[fresh] = 7;
  await applyTrackerAssignment({ vehicleId: v.id, deviceId: fresh }, w.deps());

  const all = await gaps(v.id);
  assert.equal(all.length, 1, 'the open gap is reused, not duplicated');
  assert.equal(all[0].status, 'closed_unobserved');
  assert.equal(all[0].toDeviceId, fresh);
  w.counters[fresh] = 57;
  assert.equal((await shown(v.id, w)).odometerKm, 125300);
});

test('two vehicles claiming the same tracker at once: exactly one wins, the other keeps its mileage', async () => {
  const w = world();
  const c = await company();
  const a = await vehicleOf(c, 'A');
  const b = await vehicleOf(c, 'B');
  const d = device();
  w.counters[d] = 100;
  const results = await Promise.allSettled([
    applyTrackerAssignment({ vehicleId: a.id, deviceId: d }, w.deps()),
    applyTrackerAssignment({ vehicleId: b.id, deviceId: d }, w.deps()),
  ]);
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'fulfilled'], JSON.stringify(results.map((r) => r.reason?.message)));
  const holders = await DeviceAssignment.findAll({ where: { deviceId: d, isActive: true } });
  assert.equal(holders.length, 1, 'one active assignment per physical tracker');
  for (const v of [a, b]) assert.ok((await current(v.id)).length <= 1, 'never two current anchors');
  const loser = [a, b].find((v) => v.id !== holders[0].vehicleId);
  assert.equal((await active(loser.id)).length, 0);
});

test('one vehicle given two trackers at once ends with exactly one active tracker and one current baseline', async () => {
  const w = world();
  const { v } = await establishedVehicle(w);
  const x = device(); const y = device();
  w.counters[x] = 10; w.counters[y] = 20;
  const results = await Promise.allSettled([
    applyTrackerAssignment({ vehicleId: v.id, deviceId: x }, w.deps()),
    applyTrackerAssignment({ vehicleId: v.id, deviceId: y }, w.deps()),
  ]);
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'fulfilled'], JSON.stringify(results.map((r) => r.reason?.message)));
  assert.equal((await active(v.id)).length, 1);
  assert.equal((await current(v.id)).length, 1);
  assert.equal((await current(v.id))[0].deviceId, (await active(v.id))[0].deviceId, 'the baseline refers to the tracker that is actually active');
});

// ---- maintenance schedules follow the vehicle --------------------------------------------------------

test('the vehicle\'s maintenance schedules move to the new tracker, and leave the old one', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  w.links.set(d, new Set([501, 502])); // Routine Service + another schedule on the old tracker
  const newDevice = device();
  w.counters[newDevice] = 3;

  const { change } = await applyTrackerAssignment({ vehicleId: v.id, deviceId: newDevice }, w.deps());
  const row = await VehicleTrackerChange.findByPk(change.id);
  assert.equal(row.maintenanceRelinkStatus, 'synced');
  assert.deepEqual([...row.maintenanceMoved].sort(), [501, 502]);
  assert.deepEqual([...w.links.get(newDevice)].sort(), [501, 502]);
  assert.equal(w.links.get(d).size, 0, 'the old tracker no longer carries the vehicle\'s schedules');
});

test('a failed schedule re-link is recorded and can be retried, without touching the mileage', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  w.links.set(d, new Set([601]));
  const newDevice = device();
  w.counters[newDevice] = 3;
  w.fail.link = true;

  const { change, anchor } = await applyTrackerAssignment({ vehicleId: v.id, deviceId: newDevice }, w.deps());
  let row = await VehicleTrackerChange.findByPk(change.id);
  assert.equal(row.maintenanceRelinkStatus, 'failed');
  assert.match(row.maintenanceRelinkError, /Traccar unavailable/);
  assert.equal((await current(v.id))[0].id, anchor.id, 'the swap itself committed; the mileage is safe');
  assert.deepEqual([...w.links.get(d)], [601], 'nothing was unlinked from the old tracker before it was linked to the new one');

  w.fail.link = false;
  const retried = await retryPendingMaintenanceRelinks(w.deps());
  assert.equal(retried.synced, 1);
  row = await VehicleTrackerChange.findByPk(change.id);
  assert.equal(row.maintenanceRelinkStatus, 'synced');
  assert.deepEqual([...w.links.get(newDevice)], [601]);
});

test('retrying a re-link that partly succeeded does not link twice', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  w.links.set(d, new Set([701, 702]));
  const newDevice = device();
  w.counters[newDevice] = 3;
  const { change } = await applyTrackerAssignment({ vehicleId: v.id, deviceId: newDevice }, w.deps());
  w.calls.link.length = 0;
  w.links.set(d, new Set([701, 702])); // pretend the unlink never happened
  await VehicleTrackerChange.update({ maintenanceRelinkStatus: 'failed' }, { where: { id: change.id } });
  await relinkMaintenance(change.id, w.deps());
  assert.equal(w.calls.link.length, 0, 'already linked to the new tracker: no second link');
  assert.equal(w.links.get(d).size, 0, 'but the leftover link on the old tracker is cleaned up');
  assert.equal((await VehicleTrackerChange.findByPk(change.id)).maintenanceRelinkStatus, 'synced');
});

test('a tracker change with no schedules to move is synced with nothing moved', async () => {
  const w = world();
  const { v } = await establishedVehicle(w);
  const newDevice = device();
  w.counters[newDevice] = 3;
  const { change } = await applyTrackerAssignment({ vehicleId: v.id, deviceId: newDevice }, w.deps());
  const row = await VehicleTrackerChange.findByPk(change.id);
  assert.equal(row.maintenanceRelinkStatus, 'synced');
  assert.deepEqual(row.maintenanceMoved, []);
});

test('the first tracker on a vehicle has no previous tracker, so there is nothing to re-link', async () => {
  const w = world();
  const c = await company();
  const v = await vehicleOf(c);
  const d = device();
  w.counters[d] = 5;
  const { change } = await applyTrackerAssignment({ vehicleId: v.id, deviceId: d }, w.deps());
  assert.equal((await VehicleTrackerChange.findByPk(change.id)).maintenanceRelinkStatus, 'not_applicable');
});

test('an unknown vehicle is a 404', async () => {
  const w = world();
  await assert.rejects(() => applyTrackerAssignment({ vehicleId: uuid(), deviceId: device() }, w.deps()), (e) => e.statusCode === 404);
});

// ---- the remembered accepted state follows the tracker -----------------------------------------------------

test('a tracker assigned to a vehicle is remembered from the hand-over reading, ready to be validated', async () => {
  const w = world();
  const c = await company();
  const v = await vehicleOf(c);
  const d = device();
  w.counters[d] = 80000;
  await applyTrackerAssignment({ vehicleId: v.id, deviceId: d }, w.deps());

  const state = await TrackerCounterState.findByPk(d);
  assert.equal(state.vehicleId, v.id);
  assert.equal(state.acceptedKm, 80000);
  assert.equal(state.bootstrapAcceptedKm, 80000);
  assert.equal(state.attribute, 'totalDistance');
  assert.equal((await current(v.id))[0].telemetryKm, 80000, 'the baseline and the remembered counter agree to the kilometre');
  assert.equal(state.deviceAssignmentId, (await active(v.id))[0].id);
});

test('replacing a tracker forgets the old one and remembers the new one', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  assert.ok(await TrackerCounterState.findByPk(d));
  w.counters[d] = 4400;
  const fresh = device();
  w.counters[fresh] = 3;
  await applyTrackerAssignment({ vehicleId: v.id, deviceId: fresh }, w.deps());
  assert.equal(await TrackerCounterState.findByPk(d), null, 'the old tracker no longer feeds this vehicle');
  const state = await TrackerCounterState.findByPk(fresh);
  assert.equal(state.vehicleId, v.id);
  assert.equal(state.acceptedKm, 3);
});

test('a tracker moved to another vehicle is remembered for the new vehicle only', async () => {
  const w = world();
  const { v: a, d: shared, c } = await establishedVehicle(w);
  w.counters[shared] = 9000;
  const b = await vehicleOf(c, 'B');
  await applyTrackerAssignment({ vehicleId: b.id, deviceId: shared }, w.deps());
  const state = await TrackerCounterState.findByPk(shared);
  assert.equal(state.vehicleId, b.id);
  assert.equal(state.acceptedKm, 9000, 'a fresh lineage: nothing carried from vehicle A');
  assert.equal(await TrackerCounterState.count({ where: { vehicleId: a.id } }), 0);
});

test('releasing a tracker forgets it', async () => {
  const w = world();
  const { d } = await establishedVehicle(w);
  w.counters[d] = 4100;
  await releaseTracker({ deviceId: d }, w.deps());
  assert.equal(await TrackerCounterState.findByPk(d), null);
});

test('a tracker that is silent at hand-over is not remembered yet', async () => {
  const w = world();
  const c = await company();
  const v = await vehicleOf(c);
  const d = device(); // never reported
  await applyTrackerAssignment({ vehicleId: v.id, deviceId: d }, w.deps());
  assert.equal(await TrackerCounterState.findByPk(d), null);
});

test('after a counter reset the vehicle\'s mileage carries on from the accepted counter, through a tracker change', async () => {
  const w = world();
  const { v, d } = await establishedVehicle(w);
  // the old tracker reset its own counter: raw reads 12, but the remembered accepted counter reached 4,412
  await TrackerCounterState.update({ acceptedKm: 4412, rawKm: 12 }, { where: { deviceId: d } });
  w.counters[d] = 12;
  const fresh = device();
  w.counters[fresh] = 0;
  await applyTrackerAssignment({ vehicleId: v.id, deviceId: fresh }, w.deps());
  assert.equal((await current(v.id))[0].odometerKm, 125412, '125,000 + the 412 km the accepted counter had advanced, not 125,000 + 12');
});
