import { DeviceAssignment, VehicleOdometerAnchor, TrackerCounterState } from '../../models/index.js';
import { getVehicleTelemetry } from '../../services/refuelTelemetryService.js';
import { extractTelemetryEvidence, rawTelemetryToKm } from './normaliseEvidence.js';
import { liveAcceptedCounter, readingFromPosition } from '../readings/acceptedReadings.js';

/**
 * Anchor states that count as a recorded observation for confidence purposes: a person physically
 * confirmed the value, or it is a migrated legacy anchor (which was treated as an observation before,
 * and must not silently lose confidence at deploy). Estimates carried between trackers do not.
 */
const OBSERVATION_STATES = new Set(['physically_verified', 'legacy_unverified']);

/**
 * A vehicle's anchor row, as resolver evidence for the tracker currently reporting.
 *
 * The anchor belongs to the VEHICLE. It carries the counter reading of one specific tracker, so it can
 * only be advanced by that tracker's counter: an anchor taken on a different tracker contributes its
 * accepted mileage but no counter reference (the mileage is held, not tracked, and flagged).
 * @param {object|null} anchor vehicle_odometer_anchors row (model instance or plain object)
 * @param {{ deviceId?: number|null }} [tracker] the tracker whose telemetry is being resolved
 */
export function anchorToEvidence(anchor, { deviceId = null } = {}) {
  if (!anchor) return null;
  const anchorDevice = anchor.deviceId != null ? Number(anchor.deviceId) : null;
  const deviceMismatch = anchorDevice != null && deviceId != null && anchorDevice !== Number(deviceId);
  const telemetryKm = anchor.telemetryKm != null ? Number(anchor.telemetryKm) : null;
  return {
    anchorId: anchor.id ?? null,
    anchorKm: Number(anchor.odometerKm),
    anchorTelemetryKm: deviceMismatch ? null : telemetryKm,
    anchoredAt: anchor.observedAt ?? null,
    anchorSource: anchor.source ?? null,
    anchorState: anchor.state ?? null,
    deviceMismatch,
  };
}

function evidenceFromAnchor(anchor, deviceId) {
  const evidence = anchorToEvidence(anchor, { deviceId });
  const hasObservation = Boolean(evidence) && OBSERVATION_STATES.has(evidence.anchorState);
  return {
    anchor: evidence,
    hasObservation,
    // Drift is "how far the estimate has moved from the last OBSERVATION"; an estimate carried between
    // trackers is not an observation, so it has no drift reference.
    latestObservationKm: hasObservation ? evidence.anchorKm : null,
  };
}

/** A remembered tracker state belongs to a vehicle; never use another vehicle's. */
const sameVehicle = (stateRow, vehicleId) => Boolean(stateRow)
  && (!stateRow.vehicleId || !vehicleId || String(stateRow.vehicleId) === String(vehicleId));

/** Real collaborators; tests pass fakes as the second argument of collectEvidence. */
const defaultDeps = {
  getVehicleTelemetry,
  findVehicleIdForDevice: async (deviceId) => {
    const assignment = await DeviceAssignment.findOne({
      where: { deviceId: Number(deviceId), isActive: true },
      attributes: ['vehicleId'],
    });
    return assignment?.vehicleId ?? null;
  },
  findCurrentAnchor: (vehicleId) => VehicleOdometerAnchor.findOne({ where: { vehicleId, supersededAt: null } }),
  findTrackerState: (deviceId) => TrackerCounterState.findByPk(Number(deviceId)),
};

/**
 * Gather mileage evidence for one vehicle (M2 §4).
 * @param {{ merged: object, deviceId: number|null }}
 */
export async function collectEvidence({ merged, deviceId }, deps = defaultDeps) {
  let position = merged?.position ?? null;
  let device = merged?.device ?? null;

  let telemetryKm = null;
  let telemetryAttribute = null;

  // Prefer live Traccar attrs with full evidence priority (odometer → totalDistance → mileage).
  // Merged position telemetry only exposes totalDistance; using it first could ignore a
  // updating odometer/mileage field and leave anchored mileage stuck at the last observation.
  let live = null;
  if (deviceId != null) {
    live = await deps.getVehicleTelemetry(deviceId);
    // Single-device callers (refuel capture, fuel statistics, prediction) pass no
    // device/position rows. Without these, every resolution was reported stale
    // — even for a tracker reporting this second — and scored a level too low.
    if (device == null && (live.deviceStatus != null || live.deviceLastUpdate != null)) {
      device = { status: live.deviceStatus, lastUpdate: live.deviceLastUpdate };
    }
    if (position == null && live.positionFixTime != null) {
      position = { fixTime: live.positionFixTime };
    }
    const attrs = live.positionAttributes;
    if (attrs) {
      const extracted = extractTelemetryEvidence(attrs);
      if (extracted.km != null) {
        telemetryKm = extracted.km;
        telemetryAttribute = extracted.attribute;
      }
    }
  }

  if (telemetryKm == null && position?.telemetry?.totalDistance != null) {
    const km = rawTelemetryToKm(position.telemetry.totalDistance, 'totalDistance');
    telemetryKm = km;
    telemetryAttribute = 'totalDistance';
  }

  // The mileage belongs to the vehicle. A tracker that is not assigned to a vehicle has no anchor:
  // nothing is borrowed from the tracker itself.
  const vehicleId = merged?.id ?? (deviceId != null ? await deps.findVehicleIdForDevice(deviceId) : null);
  const anchorRow = vehicleId ? await deps.findCurrentAnchor(vehicleId) : null;
  const { anchor, hasObservation, latestObservationKm } = evidenceFromAnchor(anchorRow, deviceId);

  // The counter that advances the mileage is the ACCEPTED one: the remembered state extended to the
  // tracker's latest position with the same rules the ingest uses, so a glitch can never reach the odometer.
  let acceptance;
  if (deviceId != null) {
    const remembered = await deps.findTrackerState(deviceId);
    const state = sameVehicle(remembered, vehicleId) ? remembered : null;
    const latest = live
      ? readingFromPosition({ id: live.positionId, fixtime: live.positionFixTime, attributes: live.positionAttributes }, state?.attribute ?? null)
      : null;
    const counter = liveAcceptedCounter(state, latest?.rawKm != null && latest?.fixMs != null ? latest : null);
    acceptance = { source: counter.source, quarantined: counter.quarantined, pendingKind: counter.pendingKind, acceptedAtMs: counter.acceptedAtMs ?? null };
    if (counter.source === 'accepted') {
      telemetryKm = counter.acceptedKm;
      telemetryAttribute = null; // already scale-corrected by the acceptance rules
    }
  }

  return {
    telemetryKm,
    telemetryAttribute,
    anchor,
    hasObservation,
    latestObservationKm,
    acceptance,
    device,
    position,
  };
}

/**
 * Synchronous evidence builder for callers that already hold batch-loaded device/position rows and the
 * vehicle's anchor (e.g. the fleet list, which loads them all via single IN-clause queries). Produces the
 * same evidence shape as collectEvidence() but with zero additional I/O, so it must feed the same
 * resolveOdometerFromEvidence() core rather than a second engine. Full odometer->totalDistance->mileage
 * priority is preserved by reading raw position attributes directly.
 *
 * There is deliberately no device-keyed anchor parameter: the only anchor is the vehicle's own.
 * @param {{
 *   deviceStatus: string|null,
 *   deviceLastUpdate: string|Date|null,
 *   positionFixTime: string|Date|null,
 *   positionAttributes: Record<string, unknown>|null,
 *   anchor: object|null,
 *   deviceId: number|null,
 *   acceptedCounter: { acceptedKm:number, source:'accepted'|'raw', quarantined:boolean, pendingKind:string|null }|null,
 * }}
 */
export function buildEvidenceFromBatch({
  deviceStatus = null,
  deviceLastUpdate = null,
  positionFixTime = null,
  positionAttributes = null,
  anchor: anchorRow = null,
  deviceId = null,
  acceptedCounter = null,
}) {
  let telemetryKm = null;
  let telemetryAttribute = null;
  const extracted = extractTelemetryEvidence(positionAttributes);
  if (extracted.km != null) {
    telemetryKm = extracted.km;
    telemetryAttribute = extracted.attribute;
  }

  const { anchor, hasObservation, latestObservationKm } = evidenceFromAnchor(anchorRow, deviceId);

  // The ACCEPTED counter (see collectEvidence) replaces the raw one when the ingest has met this tracker.
  let acceptance;
  if (acceptedCounter) {
    acceptance = {
      source: acceptedCounter.source,
      quarantined: Boolean(acceptedCounter.quarantined),
      pendingKind: acceptedCounter.pendingKind ?? null,
      acceptedAtMs: acceptedCounter.acceptedAtMs ?? null,
    };
    if (acceptedCounter.source === 'accepted') {
      telemetryKm = acceptedCounter.acceptedKm;
      telemetryAttribute = null;
    }
  }

  return {
    telemetryKm,
    telemetryAttribute,
    anchor,
    hasObservation,
    latestObservationKm,
    acceptance,
    device: { status: deviceStatus, lastUpdate: deviceLastUpdate },
    position: { fixTime: positionFixTime },
  };
}
