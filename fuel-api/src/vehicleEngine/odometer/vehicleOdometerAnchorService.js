/**
 * The vehicle's accepted mileage: how it is read, changed and audited.
 *
 * The VEHICLE owns its cumulative mileage; trackers only supply evidence for it. Its baseline is a row in
 * vehicle_odometer_anchors; a change never edits a row, it supersedes it with a new one (previous value,
 * source, reason, actor and evidence are recorded), so history is complete and a bad change can be
 * traced and undone by a later, explained one.
 *
 * Every write runs in one transaction behind a row lock on the vehicle, so concurrent observations,
 * assignments and baseline completions are serialised. See docs/VEHICLE_OWNED_ODOMETER.md.
 */
import { randomUUID } from 'node:crypto';
import sequelize from '../../config/database.js';
import {
  Vehicle, DeviceAssignment, VehicleSpec, VehicleOdometerAnchor, VehicleMileageGap, TrackerCounterState,
} from '../../models/index.js';
import { getVehicleTelemetry } from '../../services/refuelTelemetryService.js';
import { clearCache } from '../../services/vehicleSpecService.js';
import { buildEvidenceFromBatch } from './collectEvidence.js';
import { resolveOdometerFromEvidence } from './resolveVehicleOdometer.js';
import { assessObservation } from './odometerPlausibility.js';
import { liveAcceptedCounter, readingFromTelemetry } from '../readings/acceptedReadings.js';
import { bootstrapTrackerState } from '../readings/acceptedReadingsService.js';

export class OdometerError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'OdometerError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** The tracker's latest reading, or null when it has none. Traccar I/O: always done OUTSIDE a transaction. */
export async function readTrackerCounter(deviceId) {
  const telemetry = await getVehicleTelemetry(Number(deviceId));
  return telemetry?.positionAttributes ? telemetry : null;
}

const defaultDeps = {
  now: () => new Date(),
  readCounter: readTrackerCounter,
  readTrackerState: (deviceId) => TrackerCounterState.findByPk(Number(deviceId)),
};

const toMs = (value) => (value ? new Date(value).getTime() : null);

/**
 * What the vehicle's accepted odometer is right now, and what that rests on, using the same resolver as
 * every screen. `counter` is the active tracker's latest reading (or null).
 */
export function resolveAcceptedOdometer({ anchor, assignment, counter, trackerState = null }) {
  // The counter that advances the mileage is the ACCEPTED one: the remembered state extended to the tracker's
  // latest reading with the ingest's own rules. Anchors are recorded in these same units.
  const remembered = assignment && trackerState
    && (!trackerState.vehicleId || !anchor?.vehicleId || String(trackerState.vehicleId) === String(anchor.vehicleId))
    ? trackerState : null;
  const latest = readingFromTelemetry(counter, remembered?.attribute ?? null);
  const acceptedCounter = assignment
    ? liveAcceptedCounter(remembered, latest?.rawKm != null && latest?.fixMs != null ? latest : null)
    : null;

  const evidence = buildEvidenceFromBatch({
    deviceStatus: counter?.deviceStatus ?? null,
    deviceLastUpdate: counter?.deviceLastUpdate ?? null,
    positionFixTime: counter?.positionFixTime ?? null,
    positionAttributes: counter?.positionAttributes ?? null,
    anchor,
    deviceId: assignment?.deviceId ?? null,
    acceptedCounter,
  });
  const state = resolveOdometerFromEvidence(evidence);
  const fixMs = toMs(counter?.positionFixTime);
  const anchorMs = toMs(anchor?.observedAt);
  const newest = Math.max(fixMs ?? -Infinity, anchorMs ?? -Infinity);
  return {
    odometerKm: state.odometerKm,
    counterKm: state.telemetryKm ?? null,
    counterAt: counter?.positionFixTime ?? null,
    lastEvidenceAt: newest === -Infinity ? null : newest,
    isPhysical: anchor?.state === 'physically_verified',
    readingStatus: state.readingStatus,
  };
}

/**
 * Mirror the vehicle's current baseline onto the tracker's legacy vehicle_specs row. Nothing reads those
 * columns any more; the mirror exists so that rolling the application back to the previous release
 * resumes from the latest accepted baseline instead of a stale one, and so a tracker that has been moved
 * never carries another vehicle's values (pass null to clear).
 */
export async function mirrorToLegacySpec(deviceId, anchor, { transaction } = {}) {
  if (deviceId == null) return;
  const patch = {
    verifiedOdometerKm: anchor ? anchor.odometerKm : null,
    verifiedOdometerAt: anchor ? anchor.observedAt : null,
    verifiedOdometerSource: anchor ? String(anchor.source ?? anchor.kind).slice(0, 32) : null,
    verifiedTraccarDistance: anchor ? anchor.telemetryKm : null,
  };
  const [spec, created] = await VehicleSpec.findOrCreate({
    where: { deviceId: Number(deviceId) },
    defaults: { deviceId: Number(deviceId), tankCapacity: 60, fuelEfficiency: 10, fuelType: 'Petrol', ...patch },
    transaction,
  });
  if (!created) await spec.update(patch, { transaction });
}

export async function getCurrentAnchor(vehicleId, { transaction } = {}) {
  return VehicleOdometerAnchor.findOne({ where: { vehicleId, supersededAt: null }, transaction });
}

export async function listAnchorHistory(vehicleId, { limit = 50 } = {}) {
  return VehicleOdometerAnchor.findAll({
    where: { vehicleId },
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
  });
}

/** Lock the vehicle row for the duration of the transaction; every mileage write goes through this. */
export async function lockVehicle(vehicleId, transaction) {
  const vehicle = await Vehicle.findByPk(vehicleId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!vehicle) throw new OdometerError(404, 'vehicle_not_found', 'Vehicle not found');
  return vehicle;
}

/**
 * Close the current anchor and insert its successor in one step. The old row is superseded FIRST: the
 * unique "one current anchor per vehicle" index would reject the other order.
 */
export async function replaceCurrentAnchor({ vehicleId, companyId, current, fields, now, transaction }) {
  const id = randomUUID();
  if (current) {
    await current.update({ supersededAt: now, supersededByAnchorId: id }, { transaction });
  }
  return VehicleOdometerAnchor.create({
    id,
    vehicleId,
    companyId,
    previousAnchorId: current?.id ?? null,
    ...fields,
  }, { transaction });
}

/**
 * Record a reading of the vehicle's odometer.
 *
 * @param {{
 *   vehicleId: string,
 *   odometerKm: number,
 *   source?: string,                 manual | audit | service | onboarding
 *   confirmedPhysical?: boolean,     a person attests this was read from the dashboard (the ONLY way to
 *                                    obtain state 'physically_verified')
 *   reason?: string|null,
 *   evidence?: object,               supporting evidence (note, attachment ids, ...)
 *   observedAt?: Date,               when the reading was true (default: now)
 *   actorUserId?: number|null,       who is responsible
 * }} input
 * @throws {OdometerError} 422 with a stable `code` when the plausibility rules refuse the reading;
 *         404 unknown vehicle; 409 `tracker_changed` if the vehicle's tracker changed while this ran.
 */
export async function recordObservation(input, deps = defaultDeps) {
  const {
    vehicleId, odometerKm, source = 'manual', confirmedPhysical = false, reason = null,
    evidence = {}, observedAt = null, actorUserId = null,
  } = input;
  const now = (deps.now ?? defaultDeps.now)();
  const readCounter = deps.readCounter ?? defaultDeps.readCounter;

  // Traccar is read before the transaction, never inside it, so the vehicle lock is never held
  // across a slow external call. The assignment is re-checked under the lock.
  const readTrackerState = deps.readTrackerState ?? defaultDeps.readTrackerState;
  const before = await DeviceAssignment.findOne({ where: { vehicleId, isActive: true } });
  const counter = before ? await readCounter(Number(before.deviceId)) : null;
  const trackerState = before ? await readTrackerState(Number(before.deviceId)) : null;
  if (deps.afterCounterRead) await deps.afterCounterRead();

  const result = await sequelize.transaction(async (transaction) => {
    const vehicle = await lockVehicle(vehicleId, transaction);

    const assignment = await DeviceAssignment.findOne({ where: { vehicleId, isActive: true }, transaction });
    if ((assignment?.deviceId ?? null) !== (before?.deviceId ?? null)) {
      throw new OdometerError(409, 'tracker_changed', 'The vehicle\'s tracker changed while this reading was being recorded. Please retry.');
    }

    const current = await getCurrentAnchor(vehicleId, { transaction });
    const accepted = resolveAcceptedOdometer({ anchor: current, assignment, counter, trackerState });

    const decision = assessObservation({
      proposedKm: typeof odometerKm === 'string' && odometerKm.trim() !== '' ? Number(odometerKm) : odometerKm,
      currentKm: accepted.odometerKm,
      currentIsPhysical: accepted.isPhysical,
      lastEvidenceAt: accepted.lastEvidenceAt,
      now: now.getTime(),
      confirmedPhysical: confirmedPhysical === true,
      reason,
    });
    if (decision.decision === 'reject') {
      throw new OdometerError(422, decision.code, decision.message);
    }
    if (!decision.record) return { anchor: current, deviceId: null, unchanged: true };

    const anchor = await replaceCurrentAnchor({
      vehicleId,
      companyId: vehicle.companyId,
      current,
      now,
      transaction,
      fields: {
        deviceId: assignment ? Number(assignment.deviceId) : null,
        deviceAssignmentId: assignment?.id ?? null,
        odometerKm: Number(odometerKm),
        telemetryKm: assignment ? accepted.counterKm : null,
        telemetryAt: assignment && accepted.counterKm != null ? (accepted.counterAt ?? null) : null,
        previousOdometerKm: accepted.odometerKm,
        kind: decision.kind,
        state: decision.state,
        source: String(source).slice(0, 32),
        reason: reason ? String(reason) : null,
        actorUserId,
        observedAt: observedAt ?? now,
        evidence: {
          ...evidence,
          assessment: { code: decision.code, deltaKm: decision.deltaKm, message: decision.message },
          estimateWhenRecorded: accepted.odometerKm,
        },
      },
    });

    // A physical reading settles an unobserved gap that has already closed (the tracker is back but the
    // distance inside the gap was never seen). An estimate cannot, and a gap still open stays open.
    if (anchor.state === 'physically_verified') {
      await VehicleMileageGap.update(
        { status: 'resolved', resolvedByAnchorId: anchor.id },
        { where: { vehicleId, status: 'closed_unobserved' }, transaction },
      );
    }

    await mirrorToLegacySpec(assignment?.deviceId, anchor, { transaction });
    return { anchor, deviceId: assignment?.deviceId ?? null };
  });

  if (result.deviceId != null) clearCache(result.deviceId);
  return result.anchor;
}

/**
 * Complete a baseline that has no tracker reference yet (the tracker had not reported when the anchor was
 * set) with the tracker's first valid counter. The accepted mileage is NOT changed -- only the missing
 * reference is filled in, once -- and a physical reading stays physical. Returns the completed anchor, or
 * null when there is nothing to do (no pending baseline, tracker silent, or tracker mismatch).
 */
export async function establishPendingBaseline({ vehicleId }, deps = defaultDeps) {
  const now = (deps.now ?? defaultDeps.now)();
  const readCounter = deps.readCounter ?? defaultDeps.readCounter;

  const readTrackerState = deps.readTrackerState ?? defaultDeps.readTrackerState;
  const before = await DeviceAssignment.findOne({ where: { vehicleId, isActive: true } });
  if (!before) return null;
  const counter = await readCounter(Number(before.deviceId));
  if (!counter) return null;
  const trackerState = await readTrackerState(Number(before.deviceId));

  const result = await sequelize.transaction(async (transaction) => {
    await lockVehicle(vehicleId, transaction);
    const assignment = await DeviceAssignment.findOne({ where: { vehicleId, isActive: true }, transaction });
    if (!assignment || assignment.deviceId !== before.deviceId) return null;

    const current = await getCurrentAnchor(vehicleId, { transaction });
    if (!current || current.telemetryKm != null) return null;
    if (current.deviceId != null && Number(current.deviceId) !== Number(assignment.deviceId)) return null;

    const { counterKm } = resolveAcceptedOdometer({ anchor: null, assignment, counter, trackerState });
    if (counterKm == null) return null;

    // A tracker whose baseline is now tied to its counter is also remembered, from the very same reading,
    // so the baseline and the accepted counter agree to the kilometre.
    if (!trackerState) {
      const reading = readingFromTelemetry(counter);
      if (reading?.rawKm != null && reading?.fixMs != null) {
        await bootstrapTrackerState({
          deviceId: Number(assignment.deviceId), vehicleId, companyId: current.companyId, assignmentId: assignment.id, reading, now,
        }, { transaction });
      }
    }

    await current.update({
      deviceId: Number(assignment.deviceId),
      deviceAssignmentId: assignment.id,
      telemetryKm: counterKm,
      telemetryAt: counter.positionFixTime ?? now,
      state: current.state === 'awaiting_tracker' ? 'provisional' : current.state,
      evidence: {
        ...current.evidence,
        baselineEstablished: { at: now.toISOString(), counterKm, fixTime: counter.positionFixTime ?? null },
      },
    }, { transaction });

    // The tracker is reporting: the interval it was missing is over, but its distance stays unobserved.
    await VehicleMileageGap.update(
      { status: 'closed_unobserved', endedAt: counter.positionFixTime ?? now, toDeviceId: Number(assignment.deviceId) },
      { where: { vehicleId, status: 'open' }, transaction },
    );

    await mirrorToLegacySpec(assignment.deviceId, current, { transaction });
    return { anchor: current, deviceId: Number(assignment.deviceId) };
  });

  if (!result) return null;
  clearCache(result.deviceId);
  return result.anchor;
}


/** JSON error body for a controller: the human message always, and the stable `code` for odometer refusals. */
export function odometerErrorBody(error, fallback) {
  const message = String(error?.message ?? '').trim() || fallback;
  return error instanceof OdometerError ? { error: message, code: error.code } : { error: message };
}
