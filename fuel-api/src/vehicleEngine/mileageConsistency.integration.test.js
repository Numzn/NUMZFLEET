/**
 * One rough tracker stream, every consumer. Real database; only Traccar is scripted.
 *
 * The requirement: cumulative mileage, daily mileage, the fleet card, the vehicle's service reminder and the
 * fuel baseline must all rest on the SAME accepted evidence, so that no suspicious reading can inflate one
 * while another stays still -- and where evidence is missing, the gap is shown, not papered over.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';

import {
  Company, Vehicle, DeviceAssignment, VehicleOdometerAnchor, VehicleMileageGap, VehicleTrackerChange,
  TrackerCounterState, MileageReadingEvent, VehicleDailyMileage, VehicleSpec,
} from '../models/index.js';
import { applyTrackerAssignment } from '../services/trackerAssignmentService.js';
import { recordObservation } from './odometer/vehicleOdometerAnchorService.js';
import { ingestTracker } from './readings/acceptedReadingsService.js';
import { toMergedDto } from '../services/vehicleFleetService.js';
import { buildDailyMileageDto } from './mileage/dailyMileageReadModel.js';
import { computeDue } from '../maintenance/maintenanceDueEngine.js';
import { routineRemainingKm } from '../maintenance/routineServiceStatus.js';
import { collectEvidence } from './odometer/collectEvidence.js';
import { calculateTankToTankEfficiency } from '../utils/fuelEfficiencyUtils.js';
import { resolveOdometerFromEvidence } from './odometer/resolveVehicleOdometer.js';

const companies = [];
const devices = [];
after(async () => {
  const vehicles = await Vehicle.findAll({ where: { companyId: { [Op.in]: companies } }, attributes: ['id'] });
  const ids = vehicles.map((v) => v.id);
  if (ids.length) {
    for (const M of [MileageReadingEvent, VehicleTrackerChange, VehicleMileageGap, VehicleDailyMileage, TrackerCounterState, VehicleOdometerAnchor, DeviceAssignment]) {
      await M.destroy({ where: { vehicleId: { [Op.in]: ids } } });
    }
    await Vehicle.destroy({ where: { id: { [Op.in]: ids } } });
  }
  if (devices.length) await VehicleSpec.destroy({ where: { deviceId: { [Op.in]: devices } } });
  if (companies.length) await Company.destroy({ where: { id: { [Op.in]: companies } } });
});

let seq = 850_000 + Math.floor(Math.random() * 1000) * 10;
const iso = (s) => Date.parse(s);
const KM = 1000;

/** Scripted Traccar: positions per device in arrival order; also serves the telemetry the engine reads. */
function traccar() {
  const positions = new Map();
  let id = 50_000;
  const api = {
    positions,
    add(deviceId, at, totalKm, attributes = {}) {
      if (!positions.has(deviceId)) positions.set(deviceId, []);
      positions.get(deviceId).push({ id: (id += 1), fixtime: new Date(iso(at)).toISOString(), attributes: { totalDistance: totalKm * KM, ...attributes } });
    },
    latest: (deviceId) => (positions.get(deviceId) ?? []).at(-1) ?? null,
    telemetry(deviceId) {
      const p = api.latest(deviceId);
      return p && {
        deviceStatus: 'online', deviceLastUpdate: p.fixtime, positionFixTime: p.fixtime, positionId: p.id,
        positionAttributes: { totalDistance: p.attributes.totalDistance },
      };
    },
    deps(now) {
      return {
        now: () => new Date(iso(now)),
        readCounter: async (d) => api.telemetry(d),
        readTrackerState: async (d) => TrackerCounterState.findByPk(d),
        fetchLatestPosition: async (d) => api.latest(d),
        fetchPositions: async (d, { afterId, limit }) => (positions.get(d) ?? []).filter((p) => p.id > afterId).slice(0, limit),
        listDeviceMaintenanceIds: async () => [],
        linkMaintenance: async () => {},
        unlinkMaintenance: async () => {},
      };
    },
  };
  return api;
}

const device = () => { seq += 1; devices.push(seq); return seq; };

async function newVehicle() {
  const c = await Company.create({ slug: `consist-${uuid().slice(0, 10)}`, name: 'Consistency Co', organizationType: 'customer', status: 'active' });
  companies.push(c.id);
  return { c, vehicle: await Vehicle.create({ name: 'ALLION', companyId: c.id }) };
}

/**
 * What each consumer would show for the vehicle right now, built from the database exactly as the fleet list does.
 * `latestRaw` is whatever Traccar currently says (which may be a glitch).
 */
async function consumers({ vehicle, t, todayLocalDate, nextServiceAtKm = 130000 }) {
  const assignment = await DeviceAssignment.findOne({ where: { vehicleId: vehicle.id, isActive: true } });
  const deviceId = assignment ? Number(assignment.deviceId) : null;
  const latest = deviceId != null ? t.latest(deviceId) : null;
  const anchor = await VehicleOdometerAnchor.findOne({ where: { vehicleId: vehicle.id, supersededAt: null } });
  const state = deviceId != null ? await TrackerCounterState.findByPk(deviceId) : null;

  const dto = toMergedDto(
    vehicle,
    assignment && { deviceId, assignedAt: assignment.assignedAt },
    new Map(deviceId != null && latest ? [[deviceId, { id: deviceId, status: 'online', lastupdate: latest.fixtime, attributes: {} }]] : []),
    new Map(deviceId != null && latest ? [[deviceId, { deviceId, latitude: 0, longitude: 0, fixtime: latest.fixtime, id: latest.id, attributes: latest.attributes }]] : []),
    new Map(),
    new Map(anchor ? [[vehicle.id, anchor]] : []),
    new Map(state ? [[deviceId, state]] : []),
  );
  const row = await VehicleDailyMileage.findOne({ where: { vehicleId: vehicle.id, localDate: todayLocalDate } });
  const daily = buildDailyMileageDto(row, dto.odometerKm, { confidence: dto.odometerConfidence });
  const due = computeDue(
    { id: 1, type: 'totalDistance', start: (nextServiceAtKm - 5000) * KM, period: 5000 * KM },
    null,
    dto.odometerKm == null ? null : dto.odometerKm * KM,
  );
  return { dto, daily, due, remainingKm: routineRemainingKm({ type: 'totalDistance', remaining: due.remaining }) };
}

/** A vehicle with a physically verified 125,000 km baseline on a tracker whose counter then read 4,000 km. */
async function established({ at = '2026-10-17T21:30:00Z' } = {}) {
  const { c, vehicle } = await newVehicle();
  const t = traccar();
  const d = device();
  t.add(d, at, 4000);
  await applyTrackerAssignment({ vehicleId: vehicle.id, deviceId: d }, t.deps(at));
  await recordObservation({ vehicleId: vehicle.id, odometerKm: 125000, confirmedPhysical: true, actorUserId: 1 }, t.deps(at));
  await ingestTracker({ deviceId: d }, t.deps(at)); // the tracker is already remembered from the hand-over
  return { c, vehicle, t, d };
}

test('a suspicious jump moves NOTHING: not the odometer, not the day, not the service reminder', async () => {
  const f = await established();
  f.t.add(f.d, '2026-10-17T21:50:00Z', 4010);
  f.t.add(f.d, '2026-10-17T22:10:00Z', 4020);
  await ingestTracker({ deviceId: f.d }, f.t.deps('2026-10-17T22:15:00Z'));
  const before = await consumers({ vehicle: f.vehicle, t: f.t, todayLocalDate: '2026-10-18' });
  assert.equal(before.dto.odometerKm, 125020);

  // the tracker's counter now glitches by +90,000 km
  f.t.add(f.d, '2026-10-17T22:11:00Z', 94020);
  await ingestTracker({ deviceId: f.d }, f.t.deps('2026-10-17T22:16:00Z'));
  const after = await consumers({ vehicle: f.vehicle, t: f.t, todayLocalDate: '2026-10-18' });

  assert.equal(after.dto.odometerKm, 125020, 'the fleet card is unchanged');
  assert.equal(after.dto.odometerReadingStatus, 'quarantined', 'and says a reading is being held out');
  assert.equal(after.daily.km, before.daily.km, 'the day did not absorb the jump');
  assert.equal(after.remainingKm, before.remainingKm, 'nor did the service reminder');
  const raw = await collectEvidence({ merged: { id: f.vehicle.id }, deviceId: f.d }, {
    getVehicleTelemetry: async (id) => f.t.telemetry(id),
    findVehicleIdForDevice: async () => f.vehicle.id,
    findCurrentAnchor: (vehicleId) => VehicleOdometerAnchor.findOne({ where: { vehicleId, supersededAt: null } }),
    findTrackerState: (id) => TrackerCounterState.findByPk(id),
  });
  assert.equal(resolveOdometerFromEvidence(raw).odometerKm, 125020, 'the single-device path (fuel baseline, refuel capture) agrees');
});

test('fuel efficiency is learned from validated mileage: a glitch between two refuels cannot distort it', async () => {
  const f = await established();
  const capture = async () => resolveOdometerFromEvidence(await collectEvidence({ merged: { id: f.vehicle.id }, deviceId: f.d }, {
    getVehicleTelemetry: async (id) => f.t.telemetry(id),
    findVehicleIdForDevice: async () => f.vehicle.id,
    findCurrentAnchor: (vehicleId) => VehicleOdometerAnchor.findOne({ where: { vehicleId, supersededAt: null } }),
    findTrackerState: (id) => TrackerCounterState.findByPk(id),
  }));
  const refuel = (state, litres, daysAgo) => ({
    actualFuelLitres: litres,
    currentMileage: state.odometerKm,
    sessionDate: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    odometerConfidenceAtCapture: state.odometerConfidence,
    odometerDriftClassAtCapture: state.odometerDriftClass,
    isFullTank: true,
  });

  const first = await capture();
  assert.equal(first.odometerKm, 125000);

  // 500 km driven in ten 25-minute legs; halfway the counter glitches by +90,000 km and then carries on
  let at = iso('2026-10-17T22:00:00Z');
  let km = 4000;
  for (let leg = 1; leg <= 10; leg += 1) {
    at += 25 * 60000;
    km += 50;
    f.t.add(f.d, new Date(at).toISOString(), km);
    if (leg === 5) f.t.add(f.d, new Date(at + 60000).toISOString(), km + 90000);
    await ingestTracker({ deviceId: f.d }, f.t.deps(new Date(at + 120000).toISOString()));
  }
  // ...and the refuel is saved at the very moment the tracker's LATEST reading is a glitch again
  f.t.add(f.d, new Date(at + 5 * 60000).toISOString(), km + 90000);
  await ingestTracker({ deviceId: f.d }, f.t.deps(new Date(at + 6 * 60000).toISOString()));
  const second = await capture();
  assert.equal(second.odometerKm, 125500, 'the refuel snapshot rests on the accepted counter, not the glitch');
  assert.equal(second.readingStatus, 'quarantined', 'and says the latest reading is being held out');

  const result = calculateTankToTankEfficiency([refuel(first, 40, 10), refuel(second, 50, 1)], { windowDays: 30, tankCapacity: 80, specEfficiencyKmL: 10 });
  assert.equal(result.intervals[0].distanceKm, 500, 'the interval is the validated distance');
  assert.equal(result.kmPerLitre, 10, 'and the learned efficiency is sane (500 km on 50 L)');

  // control: the same arithmetic on the raw counter would have produced an absurd interval
  const rawSecondKm = 125000 + (94500 - 4000);
  assert.ok(rawSecondKm - first.odometerKm > 90000);
});

test('daily and cumulative mileage agree exactly: the odometer\'s movement over the day equals the day\'s total', async () => {
  const f = await established({ at: '2026-10-17T21:30:00Z' });
  const odometerAtStart = (await consumers({ vehicle: f.vehicle, t: f.t, todayLocalDate: '2026-10-18' })).dto.odometerKm;
  let km = 4000;
  // 00:00-14:00 Lusaka on the 18th: driving, a spike, a reset, a pause
  const script = [
    ['2026-10-17T22:10:00Z', 4004], ['2026-10-17T22:20:00Z', 4010], ['2026-10-18T05:00:00Z', 4010.2],
    ['2026-10-18T05:10:00Z', 4016], ['2026-10-18T05:11:00Z', 8800], ['2026-10-18T05:12:00Z', 4017],
    ['2026-10-18T05:30:00Z', 4030], ['2026-10-18T05:40:00Z', 12], ['2026-10-18T05:50:00Z', 16], ['2026-10-18T06:00:00Z', 21],
    ['2026-10-18T06:10:00Z', 27],
  ];
  for (const [at, c] of script) { f.t.add(f.d, at, c); km = c; }
  await ingestTracker({ deviceId: f.d }, f.t.deps('2026-10-18T06:15:00Z'));

  const now = await consumers({ vehicle: f.vehicle, t: f.t, todayLocalDate: '2026-10-18' });
  const days = await VehicleDailyMileage.findAll({ where: { vehicleId: f.vehicle.id }, order: [['localDate', 'ASC']] });
  const ledger = days.reduce((a, d) => a + (d.confirmedKm ?? 0) + (d.unattributedKm ?? 0), 0);

  assert.ok(Math.abs((now.dto.odometerKm - odometerAtStart) - ledger) < 1e-6, `${now.dto.odometerKm - odometerAtStart} vs ${ledger}`);
  assert.equal(now.daily.evidence, 'accepted');
  assert.ok(km < 100); // the raw counter ended far below where it started; the odometer did not
  assert.ok(now.dto.odometerKm > odometerAtStart);
});

test('a tracker swap mid-day keeps one continuous mileage; the unobserved interval is shown, not filled', async () => {
  const f = await established({ at: '2026-10-17T21:30:00Z' });
  f.t.add(f.d, '2026-10-18T05:00:00Z', 4050);
  await ingestTracker({ deviceId: f.d }, f.t.deps('2026-10-18T05:05:00Z'));

  // old tracker's last report 05:00Z; the replacement (counter at zero) is first heard from at 08:00Z
  const fresh = device();
  f.t.add(fresh, '2026-10-18T08:00:00Z', 0);
  await applyTrackerAssignment({ vehicleId: f.vehicle.id, deviceId: fresh }, f.t.deps('2026-10-18T08:01:00Z'));
  const atHandOver = await consumers({ vehicle: f.vehicle, t: f.t, todayLocalDate: '2026-10-18' });
  assert.equal(atHandOver.dto.odometerKm, 125050, 'the vehicle carried its accepted mileage across');
  assert.equal(atHandOver.dto.odometerReconciliation, 'provisional');
  assert.equal(atHandOver.dto.odometerVerification, 'estimated');

  f.t.add(fresh, '2026-10-18T08:20:00Z', 12);
  f.t.add(fresh, '2026-10-18T08:40:00Z', 30);
  await ingestTracker({ deviceId: fresh }, f.t.deps('2026-10-18T08:45:00Z'));
  const after = await consumers({ vehicle: f.vehicle, t: f.t, todayLocalDate: '2026-10-18' });

  assert.equal(after.dto.odometerKm, 125080, '125,050 + the 30 km the new tracker counted');
  const gap = await VehicleMileageGap.findOne({ where: { vehicleId: f.vehicle.id, kind: 'tracker_replacement' } });
  assert.equal(gap.status, 'closed_unobserved', 'the interval between the two trackers is a recorded gap');
  assert.equal(await TrackerCounterState.findByPk(f.d), null, 'the old tracker no longer feeds the vehicle');
  // The day holds what each tracker really observed that day (the new one's 30 km), and keeps apart the old
  // tracker's 50 km that arrived after a 7.5-hour silence (in the mileage, but not placeable in the day).
  // Nothing is invented for the three silent hours between the trackers.
  const d18 = await VehicleDailyMileage.findOne({ where: { vehicleId: f.vehicle.id, localDate: '2026-10-18' } });
  assert.ok(Math.abs(d18.confirmedKm - 30) < 1e-6, `confirmed ${d18.confirmedKm}`);
  assert.ok(Math.abs(d18.unattributedKm - 50) < 1e-6, `unattributed ${d18.unattributedKm}`);
  assert.ok(Math.abs((d18.confirmedKm + d18.unattributedKm) - (after.dto.odometerKm - 125000)) < 1e-6,
    'the day\'s total still equals how far the odometer moved');
});

test('the service reminder, the fleet card and the daily figure all rest on the same odometer', async () => {
  const f = await established();
  f.t.add(f.d, '2026-10-17T21:50:00Z', 4400 - 380); // 20 km on
  f.t.add(f.d, '2026-10-17T22:30:00Z', 4400 - 340);
  await ingestTracker({ deviceId: f.d }, f.t.deps('2026-10-17T22:35:00Z'));
  const c = await consumers({ vehicle: f.vehicle, t: f.t, todayLocalDate: '2026-10-18', nextServiceAtKm: 130000 });
  assert.equal(c.dto.odometerKm, 125060);
  assert.equal(c.remainingKm, 130000 - 125060, 'the reminder is measured against exactly the card\'s odometer');
});

test('a vehicle that stopped reporting keeps its last accepted mileage and does not pretend to be live', async () => {
  const f = await established();
  f.t.add(f.d, '2026-10-17T21:50:00Z', 4020);
  await ingestTracker({ deviceId: f.d }, f.t.deps('2026-10-17T21:55:00Z'));
  // nothing more arrives for 10 days
  const assignment = await DeviceAssignment.findOne({ where: { vehicleId: f.vehicle.id, isActive: true } });
  const stale = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
  const state = await TrackerCounterState.findByPk(f.d);
  const dto = toMergedDto(
    f.vehicle, { deviceId: f.d, assignedAt: assignment.assignedAt },
    new Map([[f.d, { id: f.d, status: 'offline', lastupdate: stale, attributes: {} }]]),
    new Map([[f.d, { deviceId: f.d, latitude: 0, longitude: 0, fixtime: stale, id: state.positionId, attributes: { totalDistance: 4020 * KM } }]]),
    new Map(),
    new Map([[f.vehicle.id, await VehicleOdometerAnchor.findOne({ where: { vehicleId: f.vehicle.id, supersededAt: null } })]]),
    new Map([[f.d, state]]),
  );
  assert.equal(dto.odometerKm, 125020, 'the last accepted value is preserved');
  assert.equal(dto.odometerConfidence, 'low', 'but it is honestly low: a week-old reading is not a live one');
});

test('a physical reading after a gap settles the interval, and the mileage follows the person\'s reading', async () => {
  const f = await established({ at: '2026-10-17T21:30:00Z' });
  f.t.add(f.d, '2026-10-18T05:00:00Z', 4050);
  await ingestTracker({ deviceId: f.d }, f.t.deps('2026-10-18T05:05:00Z'));
  const fresh = device();
  f.t.add(fresh, '2026-10-18T08:00:00Z', 0);
  await applyTrackerAssignment({ vehicleId: f.vehicle.id, deviceId: fresh }, f.t.deps('2026-10-18T08:01:00Z'));
  // the person reads the dashboard: 3 hours of unobserved driving turn out to have been 70 km
  await recordObservation({ vehicleId: f.vehicle.id, odometerKm: 125120, confirmedPhysical: true, actorUserId: 5 }, f.t.deps('2026-10-18T08:30:00Z'));

  const gap = await VehicleMileageGap.findOne({ where: { vehicleId: f.vehicle.id, kind: 'tracker_replacement' } });
  assert.equal(gap.status, 'resolved');
  const c = await consumers({ vehicle: f.vehicle, t: f.t, todayLocalDate: '2026-10-18' });
  assert.equal(c.dto.odometerKm, 125120);
  assert.equal(c.dto.odometerVerification, 'physical');
});
