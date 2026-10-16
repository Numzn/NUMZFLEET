/**
 * Tracker changes. A tracker is replaceable hardware; the vehicle is the asset whose mileage, schedules and
 * history must survive. This service owns the one place where a tracker is attached to, moved between, or
 * removed from vehicles, and keeps three things true through every such change:
 *
 *   1. The vehicle keeps its accepted odometer. A replacement tracker inherits it as a PROVISIONAL baseline,
 *      tied to the new tracker's counter at hand-over; its relationship to the baseline is not established
 *      until the tracker has been seen to report consistently, and it is never labelled physically verified.
 *   2. A tracker never brings another vehicle's mileage with it. Each vehicle's baseline is derived only from
 *      that vehicle's own history; a vehicle with none counts from the moment the tracker is assigned.
 *   3. What cannot be known is recorded as unknown. The interval between the old tracker's last report and the
 *      new tracker's first valid reading is stored as an unobserved gap; no distance is invented for it.
 *
 * Maintenance schedules live in Traccar, attached to a device. They follow the vehicle: after the change they
 * are re-linked to the new tracker (best-effort, with the outcome recorded and retryable).
 *
 * Concurrency: vehicle rows are locked in a fixed (sorted) order, then a per-tracker advisory lock is taken,
 * and the picture read before locking is re-validated under the locks. A change that raced another is retried.
 */
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Vehicle, DeviceAssignment, VehicleMileageGap, VehicleTrackerChange, TrackerCounterState,
} from '../models/index.js';
import { clearCache } from './vehicleSpecService.js';
import { traccarServiceFetch } from './traccarServiceClient.js';
import { getTraccarPool } from '../config/traccar.js';
import {
  OdometerError, lockVehicle, getCurrentAnchor, replaceCurrentAnchor, mirrorToLegacySpec,
  resolveAcceptedOdometer, readTrackerCounter,
} from '../vehicleEngine/odometer/vehicleOdometerAnchorService.js';
import { readingFromTelemetry } from '../vehicleEngine/readings/acceptedReadings.js';
import { bootstrapTrackerState, dropTrackerState } from '../vehicleEngine/readings/acceptedReadingsService.js';

const MAX_ATTEMPTS = 4;

class RaceError extends Error {}

const isRetryable = (error) => error instanceof RaceError
  || error?.original?.code === '40P01' // deadlock detected
  || error?.original?.code === '40001' // serialization failure
  || (error?.original?.code === '23505' && /device_assignments_active_|ux_vehicle_odometer_anchors_current/.test(String(error?.original?.constraint ?? error?.message)));

async function withRetry(fn) {
  let last;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error)) throw error;
      last = error;
    }
  }
  throw new OdometerError(409, 'assignment_conflict', `The tracker assignment kept conflicting with another change (${last?.message ?? 'race'}). Please retry.`);
}

/** Default Traccar-facing collaborators. Tests inject fakes. */
const defaultDeps = {
  now: () => new Date(),
  readCounter: readTrackerCounter,
  readTrackerState: (deviceId) => TrackerCounterState.findByPk(Number(deviceId)),
  listDeviceMaintenanceIds: async (deviceId) => {
    const [rows] = await getTraccarPool().execute(
      'SELECT maintenanceid AS id FROM tc_device_maintenance WHERE deviceid = ?', [Number(deviceId)],
    );
    return rows.map((r) => Number(r.id));
  },
  linkMaintenance: (deviceId, maintenanceId) => traccarServiceFetch('/api/permissions', {
    method: 'POST', body: JSON.stringify({ deviceId: Number(deviceId), maintenanceId: Number(maintenanceId) }),
  }),
  unlinkMaintenance: (deviceId, maintenanceId) => traccarServiceFetch('/api/permissions', {
    method: 'DELETE', body: JSON.stringify({ deviceId: Number(deviceId), maintenanceId: Number(maintenanceId) }),
  }),
};

const withDefaults = (deps = {}) => ({ ...defaultDeps, ...deps });
const counterKmOf = (counter) => (counter ? resolveAcceptedOdometer({ anchor: null, assignment: null, counter }).counterKm : null);
const fixTimeOf = (counter, fallback) => (counter?.positionFixTime ? new Date(counter.positionFixTime) : fallback);

/** Serialise everything that touches one physical tracker (taken AFTER the vehicle locks, so no cycle). */
async function lockTracker(deviceId, transaction) {
  await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
    replacements: { key: `tracker-assignment:${Number(deviceId)}` },
    transaction,
  });
}

async function lockVehiclesInOrder(vehicleIds, transaction) {
  const vehicles = new Map();
  for (const id of [...new Set(vehicleIds.filter(Boolean))].sort()) {
    vehicles.set(String(id), await lockVehicle(id, transaction));
  }
  return vehicles;
}

/**
 * A tracker leaves a vehicle: the vehicle keeps the odometer it had accepted at that moment (including what
 * the tracker had counted since its baseline), held and flagged, and an open gap starts.
 */
async function recordRemoval({ vehicleId, companyId, assignment, counter, trackerState, reason, actorUserId, now, transaction }) {
  const current = await getCurrentAnchor(vehicleId, { transaction });
  const accepted = resolveAcceptedOdometer({ anchor: current, assignment, counter, trackerState });
  if (accepted.odometerKm == null) return { anchor: null, gap: null }; // the vehicle never had any mileage to hold

  const observedAt = fixTimeOf(counter, now);
  const anchor = await replaceCurrentAnchor({
    vehicleId,
    companyId,
    current,
    now,
    transaction,
    fields: {
      deviceId: null,
      deviceAssignmentId: null,
      odometerKm: accepted.odometerKm,
      telemetryKm: null,
      previousOdometerKm: accepted.odometerKm,
      kind: 'tracker_removal',
      state: 'trusted_estimate',
      source: 'system',
      reason,
      actorUserId,
      observedAt,
      evidence: {
        removedTracker: { deviceId: Number(assignment.deviceId), counterKm: accepted.counterKm, counterAt: counter?.positionFixTime ?? null },
        previousState: current?.state ?? null,
      },
    },
  });
  const gap = await VehicleMileageGap.create({
    vehicleId,
    companyId,
    kind: 'no_tracker',
    fromDeviceId: Number(assignment.deviceId),
    startedAt: observedAt,
    lastOdometerKm: accepted.odometerKm,
    status: 'open',
  }, { transaction });
  return { anchor, gap };
}

/**
 * Attach `deviceId` to `vehicleId`, replacing the vehicle's current tracker and taking the tracker from any
 * other vehicle that holds it.
 * @returns {Promise<{ noop: boolean, assignment, anchor, gap, change, ended: object[] }>}
 */
export async function applyTrackerAssignment({ vehicleId, deviceId, actorUserId = null }, injected = {}) {
  const deps = withDefaults(injected);
  const device = Number(deviceId);

  const result = await withRetry(async () => {
    const target = await Vehicle.findByPk(vehicleId);
    if (!target) throw new OdometerError(404, 'vehicle_not_found', 'Vehicle not found');

    // What we see before locking. External (Traccar) reads happen here, never inside the transaction.
    const prevSeen = await DeviceAssignment.findOne({ where: { vehicleId, isActive: true } });
    const holderSeen = await DeviceAssignment.findOne({ where: { deviceId: device, isActive: true } });
    const noopSeen = prevSeen && Number(prevSeen.deviceId) === device;
    const newCounter = noopSeen ? null : await deps.readCounter(device);
    const oldCounter = prevSeen && !noopSeen ? await deps.readCounter(Number(prevSeen.deviceId)) : null;
    // the remembered accepted state of the tracker leaving this vehicle, and of the tracker being taken
    const oldState = prevSeen && !noopSeen ? await deps.readTrackerState(Number(prevSeen.deviceId)) : null;
    const deviceState = noopSeen ? null : await deps.readTrackerState(device);

    return sequelize.transaction(async (transaction) => {
      const vehicles = await lockVehiclesInOrder([vehicleId, holderSeen?.vehicleId], transaction);
      await lockTracker(device, transaction);

      const prev = await DeviceAssignment.findOne({ where: { vehicleId, isActive: true }, transaction });
      const holder = await DeviceAssignment.findOne({ where: { deviceId: device, isActive: true }, transaction });
      if ((prev?.id ?? null) !== (prevSeen?.id ?? null) || (holder?.id ?? null) !== (holderSeen?.id ?? null)) {
        throw new RaceError('assignment changed while locking');
      }

      if (prev && Number(prev.deviceId) === device) {
        return { noop: true, assignment: prev, anchor: await getCurrentAnchor(vehicleId, { transaction }), gap: null, change: null, ended: [] };
      }

      const now = deps.now();
      const company = vehicles.get(String(vehicleId)).companyId;
      const ended = [];

      // Last tracker this vehicle had (for re-linking schedules), taken before the active one is closed.
      const lastEnded = prev ? null : await DeviceAssignment.findOne({
        where: { vehicleId, isActive: false },
        order: [['unassignedAt', 'DESC']],
        transaction,
      });

      if (prev) {
        await prev.update({ isActive: false, unassignedAt: now }, { transaction });
        ended.push(prev);
      }
      if (holder) {
        await holder.update({ isActive: false, unassignedAt: now }, { transaction });
        ended.push(holder);
        // the tracker comes off the other vehicle: that vehicle keeps the mileage it had
        await recordRemoval({
          vehicleId: holder.vehicleId,
          companyId: vehicles.get(String(holder.vehicleId)).companyId,
          assignment: holder,
          counter: newCounter,
          trackerState: deviceState,
          reason: `Tracker ${device} was assigned to another vehicle`,
          actorUserId,
          now,
          transaction,
        });
      }

      const assignment = await DeviceAssignment.create({ vehicleId, deviceId: device, isActive: true, assignedAt: now }, { transaction });

      // --- carry the vehicle's own mileage onto the new tracker -------------------------------------------
      const currentAnchor = await getCurrentAnchor(vehicleId, { transaction });
      const carriedFrom = resolveAcceptedOdometer({ anchor: currentAnchor, assignment: prev, counter: oldCounter, trackerState: oldState });
      const carried = carriedFrom.odometerKm; // null: this vehicle has never had any mileage
      const newCounterKm = counterKmOf(newCounter);
      const hasHistory = carried != null;

      const anchor = await replaceCurrentAnchor({
        vehicleId,
        companyId: company,
        current: currentAnchor,
        now,
        transaction,
        fields: {
          deviceId: device,
          deviceAssignmentId: assignment.id,
          odometerKm: hasHistory ? carried : 0,
          telemetryKm: newCounterKm,
          telemetryAt: newCounterKm != null ? fixTimeOf(newCounter, now) : null,
          previousOdometerKm: carried,
          kind: hasHistory ? 'tracker_replacement' : 'assignment_start',
          state: newCounterKm != null ? 'provisional' : 'awaiting_tracker',
          source: 'system',
          reason: prev ? `Tracker replaced (${prev.deviceId} to ${device})` : 'Tracker assigned',
          actorUserId,
          observedAt: now,
          evidence: {
            from: prev ? { deviceId: Number(prev.deviceId), counterKm: carriedFrom.counterKm, counterAt: oldCounter?.positionFixTime ?? null } : null,
            to: { deviceId: device, counterKm: newCounterKm, counterAt: newCounter?.positionFixTime ?? null },
            carriedOdometerKm: carried,
            // a vehicle with no history counts the distance driven since this tracker was assigned
            unknownBaseline: !hasHistory,
          },
        },
      });

      // --- the unobserved interval -------------------------------------------------------------------------
      let gap = null;
      if (hasHistory) {
        const openGap = await VehicleMileageGap.findOne({ where: { vehicleId, status: 'open' }, order: [['started_at', 'DESC']], transaction });
        const startedAt = openGap?.startedAt ?? fixTimeOf(oldCounter, currentAnchor?.observedAt ?? now);
        let endedAt = newCounterKm != null ? fixTimeOf(newCounter, now) : null;
        if (endedAt && endedAt < new Date(startedAt)) endedAt = new Date(startedAt);
        const gapFields = {
          toDeviceId: device,
          endedAt,
          status: newCounterKm != null ? 'closed_unobserved' : 'open',
        };
        if (openGap) {
          gap = await openGap.update(gapFields, { transaction });
        } else {
          gap = await VehicleMileageGap.create({
            vehicleId,
            companyId: company,
            kind: prev ? 'tracker_replacement' : 'no_tracker',
            fromDeviceId: prev?.deviceId ?? null,
            startedAt,
            lastOdometerKm: carried,
            ...gapFields,
          }, { transaction });
        }
      }

      const fromDeviceId = prev?.deviceId ?? lastEnded?.deviceId ?? null;
      const change = await VehicleTrackerChange.create({
        vehicleId,
        companyId: company,
        fromDeviceId: fromDeviceId != null ? Number(fromDeviceId) : null,
        toDeviceId: device,
        fromAssignmentId: prev?.id ?? lastEnded?.id ?? null,
        toAssignmentId: assignment.id,
        anchorId: anchor.id,
        gapId: gap?.id ?? null,
        carriedOdometerKm: carried,
        changedAt: now,
        actorUserId,
        maintenanceRelinkStatus: fromDeviceId != null && Number(fromDeviceId) !== device ? 'pending' : 'not_applicable',
      }, { transaction });

      // The tracker's legacy spec row must hold THIS vehicle's baseline, never the previous vehicle's.
      await mirrorToLegacySpec(device, anchor, { transaction });

      // The remembered accepted counter follows the tracker: the one it is leaving is forgotten, and the new
      // one starts at the hand-over reading -- the same reading the baseline above was tied to. A tracker
      // that has not reported yet is remembered from its first report instead.
      if (prev) await dropTrackerState(prev.deviceId, { transaction });
      const handOver = readingFromTelemetry(newCounter);
      if (handOver?.rawKm != null && handOver?.fixMs != null) {
        await bootstrapTrackerState({
          deviceId: device, vehicleId, companyId: company, assignmentId: assignment.id, reading: handOver, now,
        }, { transaction });
      } else {
        await dropTrackerState(device, { transaction });
      }

      return { noop: false, assignment, anchor, gap, change, ended };
    });
  });

  if (!result.noop) {
    clearCache(device);
    for (const a of result.ended) clearCache(Number(a.deviceId));
    if (result.change?.maintenanceRelinkStatus === 'pending') {
      await relinkMaintenance(result.change.id, deps); // best-effort: outcome is recorded on the change
      await result.change.reload();
    }
  }
  return result;
}

/**
 * Detach a tracker from whichever vehicle holds it without replacing it. The vehicle keeps its accepted
 * mileage (held and flagged) and an open gap begins. Returns null when the tracker is not assigned.
 */
export async function releaseTracker({ deviceId, actorUserId = null }, injected = {}) {
  const deps = withDefaults(injected);
  const device = Number(deviceId);

  const result = await withRetry(async () => {
    const seen = await DeviceAssignment.findOne({ where: { deviceId: device, isActive: true } });
    if (!seen) return null;
    const counter = await deps.readCounter(device);
    const trackerState = await deps.readTrackerState(device);

    return sequelize.transaction(async (transaction) => {
      const vehicles = await lockVehiclesInOrder([seen.vehicleId], transaction);
      await lockTracker(device, transaction);
      const holder = await DeviceAssignment.findOne({ where: { deviceId: device, isActive: true }, transaction });
      if (!holder) return null;
      if (holder.id !== seen.id) throw new RaceError('assignment changed while locking');

      const now = deps.now();
      await holder.update({ isActive: false, unassignedAt: now }, { transaction });
      const removal = await recordRemoval({
        vehicleId: holder.vehicleId,
        companyId: vehicles.get(String(holder.vehicleId)).companyId,
        assignment: holder,
        counter,
        trackerState,
        reason: `Tracker ${device} was released`,
        actorUserId,
        now,
        transaction,
      });
      await dropTrackerState(device, { transaction });
      return { assignment: holder, ...removal };
    });
  });

  if (result) clearCache(device);
  return result;
}

/**
 * Move the vehicle's maintenance schedules from its previous tracker to the new one. Idempotent: a schedule
 * already on the new tracker is not linked again, and a schedule is only unlinked from the old tracker once
 * it is safely linked to the new one. Records the outcome on the change so a failure can be retried.
 */
export async function relinkMaintenance(changeId, injected = {}) {
  const deps = withDefaults(injected);
  const change = await VehicleTrackerChange.findByPk(changeId);
  if (!change) return null;
  if (change.maintenanceRelinkStatus === 'synced' || change.maintenanceRelinkStatus === 'not_applicable') return change;

  const from = change.fromDeviceId;
  const to = change.toDeviceId;
  if (from == null || to == null || Number(from) === Number(to)) {
    return change.update({ maintenanceRelinkStatus: 'not_applicable' });
  }

  const moved = new Set((change.maintenanceMoved ?? []).map(Number));
  try {
    const onOld = await deps.listDeviceMaintenanceIds(from);
    const onNew = new Set((await deps.listDeviceMaintenanceIds(to)).map(Number));
    for (const maintenanceId of onOld) {
      if (!onNew.has(Number(maintenanceId))) await deps.linkMaintenance(to, maintenanceId);
      await deps.unlinkMaintenance(from, maintenanceId);
      moved.add(Number(maintenanceId));
    }
    return await change.update({
      maintenanceRelinkStatus: 'synced',
      maintenanceRelinkError: null,
      maintenanceMoved: [...moved],
    });
  } catch (error) {
    return change.update({
      maintenanceRelinkStatus: 'failed',
      maintenanceRelinkError: String(error?.message ?? error).slice(0, 500),
      maintenanceMoved: [...moved],
    });
  }
}

/** Retry every schedule re-link that is still pending or failed (called from the mileage housekeeping sweep). */
export async function retryPendingMaintenanceRelinks(injected = {}) {
  const pending = await VehicleTrackerChange.findAll({
    where: { maintenanceRelinkStatus: { [Op.in]: ['pending', 'failed'] } },
    order: [['changed_at', 'ASC']],
    limit: 50,
  });
  const summary = { attempted: pending.length, synced: 0, failed: 0 };
  for (const change of pending) {
    const updated = await relinkMaintenance(change.id, injected);
    if (updated?.maintenanceRelinkStatus === 'failed') summary.failed += 1;
    else summary.synced += 1;
  }
  return summary;
}
