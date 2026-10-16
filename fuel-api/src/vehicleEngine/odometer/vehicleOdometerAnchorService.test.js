/**
 * The vehicle's accepted-mileage write path, against a real database (transactions and row locks are
 * the point). Only the Traccar counter read is faked.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  Company, Vehicle, DeviceAssignment, VehicleSpec, VehicleOdometerAnchor, VehicleMileageGap, TrackerCounterState,
} from '../../models/index.js';
import {
  recordObservation, getCurrentAnchor, listAnchorHistory, establishPendingBaseline,
} from './vehicleOdometerAnchorService.js';

const createdCompanies = [];
const createdDevices = [];
after(async () => {
  const vehicles = await Vehicle.findAll({ where: { companyId: { [Op.in]: createdCompanies } }, attributes: ['id'] });
  const ids = vehicles.map((v) => v.id);
  if (ids.length) {
    await VehicleMileageGap.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    await TrackerCounterState.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    await VehicleOdometerAnchor.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    await DeviceAssignment.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    await Vehicle.destroy({ where: { id: { [Op.in]: ids } } });
  }
  if (createdDevices.length) await VehicleSpec.destroy({ where: { deviceId: { [Op.in]: createdDevices } } });
  if (createdCompanies.length) await Company.destroy({ where: { id: { [Op.in]: createdCompanies } } });
});

let deviceSeq = 810_000 + Math.floor(Math.random() * 1000) * 10;
const nextDevice = () => { deviceSeq += 1; createdDevices.push(deviceSeq); return deviceSeq; };

async function makeVehicle({ tracker = true } = {}) {
  const company = await Company.create({
    slug: `anchor-svc-${uuid().slice(0, 10)}`, name: 'Anchor Svc Co', organizationType: 'customer', status: 'active',
  });
  createdCompanies.push(company.id);
  const vehicle = await Vehicle.create({ name: 'ALLION', companyId: company.id });
  let deviceId = null;
  let assignment = null;
  if (tracker) {
    deviceId = nextDevice();
    assignment = await DeviceAssignment.create({ vehicleId: vehicle.id, deviceId, isActive: true, assignedAt: new Date('2026-01-01T00:00:00Z') });
  }
  return { company, vehicle, deviceId, assignment };
}

const NOW = new Date('2026-10-16T10:00:00Z');
/** A tracker that is reporting right now, with the given counter (km). */
const reporting = (counterKm) => async () => ({
  deviceStatus: 'online',
  deviceLastUpdate: new Date(NOW.getTime() - 5_000).toISOString(),
  positionFixTime: new Date(NOW.getTime() - 8_000).toISOString(),
  positionAttributes: { totalDistance: counterKm * 1000 },
});
const silent = async () => null;
const deps = (readCounter, over = {}) => ({ now: () => NOW, readCounter, readTrackerState: async () => null, ...over });

const obs = (vehicleId, odometerKm, over = {}) => ({
  vehicleId, odometerKm, source: 'manual', confirmedPhysical: true, actorUserId: 42, ...over,
});
const currentRows = (vehicleId) => VehicleOdometerAnchor.findAll({ where: { vehicleId, supersededAt: null } });
const allRows = (vehicleId) => VehicleOdometerAnchor.findAll({ where: { vehicleId }, order: [['createdAt', 'ASC']] });

test('the first physical observation becomes the vehicle\'s baseline, with its full audit trail', async () => {
  const { vehicle, company, deviceId, assignment } = await makeVehicle();
  const anchor = await recordObservation(
    obs(vehicle.id, 125000, { reason: 'Read at onboarding', evidence: { note: 'photo of cluster', attachmentId: 'f-1' }, observedAt: new Date('2026-10-16T09:30:00Z') }),
    deps(reporting(4000)),
  );

  assert.equal(anchor.odometerKm, 125000);
  assert.equal(anchor.state, 'physically_verified');
  assert.equal(anchor.kind, 'observation');
  assert.equal(anchor.source, 'manual');
  assert.equal(anchor.reason, 'Read at onboarding');
  assert.equal(anchor.actorUserId, 42);
  assert.equal(anchor.companyId, company.id);
  assert.equal(anchor.deviceId, deviceId);
  assert.equal(anchor.deviceAssignmentId, assignment.id);
  assert.equal(anchor.telemetryKm, 4000, 'the tracker counter at that moment is the reference');
  assert.equal(anchor.previousOdometerKm, 4000, 'what the system was showing: the tracker\'s own counter, there being no baseline yet');
  assert.equal(anchor.observedAt.toISOString(), '2026-10-16T09:30:00.000Z');
  assert.equal(anchor.evidence.note, 'photo of cluster');
  assert.equal(anchor.evidence.assessment.code, 'establishes_baseline', 'a dashboard reading replaces an unverified tracker-only estimate');
  assert.equal(anchor.supersededAt, null);
  assert.equal((await currentRows(vehicle.id)).length, 1);
});

test('a later observation supersedes the previous one: history is kept, exactly one is current', async () => {
  const { vehicle } = await makeVehicle();
  const first = await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000)));
  const second = await recordObservation(obs(vehicle.id, 125600, { reason: 'Service visit' }), deps(reporting(4500)));

  const rows = await allRows(vehicle.id);
  assert.equal(rows.length, 2);
  const [oldRow, newRow] = rows;
  assert.equal(oldRow.id, first.id);
  assert.ok(oldRow.supersededAt, 'the old baseline is closed, not deleted');
  assert.equal(oldRow.supersededByAnchorId, second.id);
  assert.equal(newRow.previousAnchorId, first.id);
  assert.equal(newRow.previousOdometerKm, 125500, 'the audit records the accepted value it replaced: 125,000 + 500 km counted');
  assert.equal((await currentRows(vehicle.id)).length, 1);
  assert.equal((await getCurrentAnchor(vehicle.id)).id, second.id);
  assert.deepEqual((await listAnchorHistory(vehicle.id)).map((r) => r.id), [second.id, first.id], 'newest first');
});

test('an implausible reading is rejected with a stable code and changes nothing', async () => {
  const { vehicle } = await makeVehicle();
  await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000)));

  await assert.rejects(
    () => recordObservation(obs(vehicle.id, 1250000), deps(reporting(4000))),
    (error) => error.statusCode === 422 && error.code === 'implausible_increase' && /check the digits/i.test(error.message),
  );
  const rows = await allRows(vehicle.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].supersededAt, null);
});

test('"trust the live reading" changes nothing: it adds no information and must not weaken a verified baseline', async () => {
  const { vehicle } = await makeVehicle();
  const verified = await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000)));
  const result = await recordObservation(
    obs(vehicle.id, 125400, { source: 'audit', confirmedPhysical: false }),
    deps(reporting(4400)),
  );
  assert.equal(result.id, verified.id, 'the existing baseline is returned unchanged');
  assert.equal(result.state, 'physically_verified');
  assert.equal((await allRows(vehicle.id)).length, 1, 'no new row, no downgrade');
});

test('an unattested first baseline is recorded, but only ever as an estimate', async () => {
  const { vehicle } = await makeVehicle({ tracker: false });
  const anchor = await recordObservation(obs(vehicle.id, 88000, { confirmedPhysical: false }), deps(silent));
  assert.equal(anchor.state, 'trusted_estimate');
});

test('an unattested reading that materially disagrees is refused', async () => {
  const { vehicle } = await makeVehicle();
  await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000)));
  await assert.rejects(
    () => recordObservation(obs(vehicle.id, 131000, { confirmedPhysical: false }), deps(reporting(4000))),
    (error) => error.code === 'needs_physical_confirmation',
  );
});

test('lowering a verified odometer is recorded as a correction, and needs a reason', async () => {
  const { vehicle } = await makeVehicle();
  await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000)));

  await assert.rejects(
    () => recordObservation(obs(vehicle.id, 100000), deps(reporting(4000))),
    (error) => error.code === 'correction_requires_reason',
  );
  const fixed = await recordObservation(
    obs(vehicle.id, 100000, { reason: 'Instrument cluster replaced; new cluster reads 100,000' }),
    deps(reporting(4000)),
  );
  assert.equal(fixed.kind, 'correction');
  assert.equal(fixed.state, 'physically_verified');
  assert.match(fixed.reason, /cluster replaced/);
  assert.equal(fixed.previousOdometerKm, 125000);
});

test('the vehicle owns its mileage: a reading can be recorded before any tracker is assigned', async () => {
  const { vehicle } = await makeVehicle({ tracker: false });
  const anchor = await recordObservation(obs(vehicle.id, 88000), deps(silent));
  assert.equal(anchor.deviceId, null);
  assert.equal(anchor.deviceAssignmentId, null);
  assert.equal(anchor.telemetryKm, null);
  assert.equal(anchor.state, 'physically_verified');
});

test('a reading taken while the tracker is silent has no counter reference yet (the baseline is pending)', async () => {
  const { vehicle, deviceId } = await makeVehicle();
  const anchor = await recordObservation(obs(vehicle.id, 125000), deps(silent));
  assert.equal(anchor.deviceId, deviceId);
  assert.equal(anchor.telemetryKm, null);
});

test('establishing a pending baseline captures the tracker\'s first counter and nothing else', async () => {
  const { vehicle } = await makeVehicle();
  const pending = await recordObservation(obs(vehicle.id, 125000), deps(silent));

  const none = await establishPendingBaseline({ vehicleId: vehicle.id }, deps(silent));
  assert.equal(none, null, 'still silent: nothing to establish');

  const done = await establishPendingBaseline({ vehicleId: vehicle.id }, deps(reporting(77)));
  assert.equal(done.id, pending.id, 'completes the row; it does not rewrite the accepted mileage');
  assert.equal(done.telemetryKm, 77);
  assert.equal(done.odometerKm, 125000);
  assert.equal(done.state, 'physically_verified', 'a physical reading stays physical');
  assert.ok(done.evidence.baselineEstablished.counterKm === 77);

  assert.equal(await establishPendingBaseline({ vehicleId: vehicle.id }, deps(reporting(99))), null, 'only ever once');
  assert.equal((await getCurrentAnchor(vehicle.id)).telemetryKm, 77);
});

test('concurrent observations are serialised: one current anchor, both recorded, no constraint error', async () => {
  const { vehicle } = await makeVehicle();
  await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000)));
  const results = await Promise.allSettled([
    recordObservation(obs(vehicle.id, 125100), deps(reporting(4100))),
    recordObservation(obs(vehicle.id, 125200), deps(reporting(4200))),
    recordObservation(obs(vehicle.id, 125300), deps(reporting(4300))),
  ]);
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'fulfilled', 'fulfilled'], JSON.stringify(results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message)));
  assert.equal((await currentRows(vehicle.id)).length, 1);
  const rows = await allRows(vehicle.id);
  assert.equal(rows.length, 4);
  // a clean chain: every row but the current one is superseded by exactly the next one in time
  const chain = rows.filter((r) => r.supersededAt);
  assert.equal(chain.length, 3);
  assert.equal(new Set(chain.map((r) => r.supersededByAnchorId)).size, 3);
});

test('a tracker change between reading the counter and writing is detected, not silently mis-recorded', async () => {
  const { vehicle, assignment } = await makeVehicle();
  const swapped = nextDevice();
  await assert.rejects(
    () => recordObservation(obs(vehicle.id, 125000), deps(reporting(4000), {
      afterCounterRead: async () => {
        await assignment.update({ isActive: false, unassignedAt: new Date() });
        await DeviceAssignment.create({ vehicleId: vehicle.id, deviceId: swapped, isActive: true });
      },
    })),
    (error) => error.statusCode === 409 && error.code === 'tracker_changed',
  );
  assert.equal((await allRows(vehicle.id)).length, 0);
});

test('a physical observation settles an unobserved gap that has closed; an estimate does not; an open gap stays open', async () => {
  const { vehicle, company } = await makeVehicle();
  await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000))); // an established, physically verified baseline
  const mk = (status) => VehicleMileageGap.create({
    vehicleId: vehicle.id, companyId: company.id, kind: 'tracker_replacement',
    startedAt: new Date('2026-10-10T00:00:00Z'), status,
  });
  const closed = await mk('closed_unobserved');
  const open = await mk('open');
  await recordObservation(obs(vehicle.id, 125000, { confirmedPhysical: false, source: 'audit' }), deps(reporting(4000)));
  assert.equal((await closed.reload()).status, 'closed_unobserved', 'an estimate cannot settle it');

  const physical = await recordObservation(obs(vehicle.id, 125010), deps(reporting(4010)));
  assert.equal((await closed.reload()).status, 'resolved');
  assert.equal(closed.resolvedByAnchorId, physical.id);
  assert.equal((await open.reload()).status, 'open', 'the tracker is still missing');
});

test('each change is mirrored onto the tracker\'s legacy spec row, so the previous release stays correct if rolled back to', async () => {
  const { vehicle, deviceId } = await makeVehicle();
  await recordObservation(obs(vehicle.id, 125000, { source: 'service' }), deps(reporting(4000)));
  const spec = await VehicleSpec.findOne({ where: { deviceId } });
  assert.equal(spec.verifiedOdometerKm, 125000);
  assert.equal(spec.verifiedTraccarDistance, 4000);
  assert.equal(spec.verifiedOdometerSource, 'service');

  await recordObservation(obs(vehicle.id, 125600), deps(reporting(4500)));
  assert.equal((await VehicleSpec.findOne({ where: { deviceId } })).verifiedOdometerKm, 125600);
});

test('an unknown vehicle is a 404 and writes nothing', async () => {
  await assert.rejects(
    () => recordObservation(obs(uuid(), 125000), deps(silent)),
    (error) => error.statusCode === 404,
  );
});

// ---- the anchor's counter reference is in ACCEPTED units --------------------------------------------------

const rememberedState = (vehicle, deviceId, acceptedKm, extra = {}) => ({
  deviceId, vehicleId: vehicle.id, acceptedKm, rawKm: acceptedKm, attribute: 'totalDistance',
  fixTime: new Date(NOW.getTime() - 60_000), positionId: 5, positionCursor: 5, pending: null, ...extra,
});

test('an observation records the ACCEPTED counter as its reference, not a glitching raw reading', async () => {
  const { vehicle, deviceId } = await makeVehicle();
  // the tracker's raw counter has just jumped to 99,999 km; the remembered accepted counter is 4,400
  const anchor = await recordObservation(
    obs(vehicle.id, 125000),
    deps(reporting(99999), { readTrackerState: async () => rememberedState(vehicle, deviceId, 4400) }),
  );
  assert.equal(anchor.telemetryKm, 4400, 'the jump is not baked into the baseline');
});

test('after a counter reset the reference stays continuous, so the odometer does not jump', async () => {
  const { vehicle, deviceId } = await makeVehicle();
  // the raw counter restarted and reads 12; the accepted counter, continuous across the reset, reads 4,412
  const anchor = await recordObservation(
    obs(vehicle.id, 125000),
    deps(reporting(12), { readTrackerState: async () => rememberedState(vehicle, deviceId, 4412, { rawKm: 12 }) }),
  );
  assert.equal(anchor.telemetryKm, 4412);
});

test('without a remembered state the raw counter is used, as before', async () => {
  const { vehicle } = await makeVehicle();
  const anchor = await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000)));
  assert.equal(anchor.telemetryKm, 4000);
});

test('a physical reading is judged against the accepted odometer, not against a glitching raw one', async () => {
  const { vehicle, deviceId } = await makeVehicle();
  await recordObservation(obs(vehicle.id, 125000), deps(reporting(4000), { readTrackerState: async () => rememberedState(vehicle, deviceId, 4000) }));
  // raw counter glitches to 99,999 (would look like +95,999 km); the accepted counter says 4,100 => estimate 125,100
  const ok = await recordObservation(
    obs(vehicle.id, 125150),
    deps(reporting(99999), { readTrackerState: async () => rememberedState(vehicle, deviceId, 4100) }),
  );
  assert.equal(ok.previousOdometerKm, 125100, 'the figure shown at the time came from the accepted counter');
});

test('establishing a pending baseline also remembers the tracker, from the very same reading', async () => {
  const { vehicle, deviceId } = await makeVehicle();
  await recordObservation(obs(vehicle.id, 125000), deps(silent));
  const done = await establishPendingBaseline({ vehicleId: vehicle.id }, deps(reporting(77), { readTrackerState: async () => null }));
  assert.equal(done.telemetryKm, 77);
  const state = await TrackerCounterState.findByPk(deviceId);
  assert.ok(state, 'a tracker whose baseline is now tied to its counter is also being tracked');
  assert.equal(state.acceptedKm, 77);
  assert.equal(state.vehicleId, vehicle.id);
});
