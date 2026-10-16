import { collectEvidence } from './collectEvidence.js';
import { resolveOdometerKm } from './resolveOdometer.js';
import {
  validateTelemetryFreshness,
  detectResetSuspected,
  detectUnitMismatch,
} from './validateEvidence.js';
import { calculateDrift } from './calculateDrift.js';
import { scoreConfidence } from './scoreConfidence.js';

/**
 * How much a person can rely on the value, separately from how confident the estimate is:
 *   physical            a person confirmed a dashboard reading
 *   unverified_legacy   migrated from the old tracker-keyed anchor; provenance unknown
 *   estimated           derived from tracker evidence, or carried over without physical confirmation
 *   none                no mileage at all
 * A GPS-derived value is never 'physical'.
 */
function describeVerification(anchor, odometerKm) {
  if (!anchor) return odometerKm == null ? 'none' : 'estimated';
  if (anchor.anchorState === 'physically_verified') return 'physical';
  if (anchor.anchorState === 'legacy_unverified') return 'unverified_legacy';
  return 'estimated';
}

/**
 * Where the vehicle's baseline stands relative to the tracker now reporting:
 *   none               no anchor
 *   awaiting_tracker   the tracker has no counter reference yet, so the mileage is held, not tracked
 *   provisional        carried onto a replacement tracker; its relationship to the baseline is not established
 *   established        the tracker's counter is tied to the accepted baseline
 */
function describeReconciliation(anchor, baselinePending) {
  if (!anchor) return 'none';
  if (baselinePending) return 'awaiting_tracker';
  if (anchor.anchorState === 'provisional') return 'provisional';
  return 'established';
}

/**
 * Whether the tracker's counter is being taken at face value:
 *   accepted     every reading behind the figure passed the acceptance rules
 *   quarantined  a reading is being held out (a jump or reset awaiting confirmation); the figure ignores it
 *   unvalidated  the ingest has not met this tracker yet, so its raw counter is used as before
 *   none         no counter
 */
function describeReadingStatus(acceptance, telemetryKm) {
  if (!acceptance) return telemetryKm == null ? 'none' : 'unvalidated';
  if (acceptance.quarantined) return 'quarantined';
  if (acceptance.source === 'accepted') return 'accepted';
  return telemetryKm == null ? 'none' : 'unvalidated';
}

function describeEvidenceAt(acceptance, evidence) {
  const ms = acceptance?.acceptedAtMs;
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  const fix = evidence.position?.fixTime;
  return fix ? new Date(fix).toISOString() : null;
}

/**
 * Pure resolution core (M2 §3) — no I/O. Takes evidence already gathered
 * (either via collectEvidence's per-device fetch, or built synchronously
 * from an already-batch-loaded device/position/spec) and produces the one
 * canonical odometer result. This is the single mileage engine; every
 * caller (single-vehicle or batched) must resolve through this function.
 * @param {{ telemetryKm: number|null, telemetryAttribute: string|null, anchor: object|null, hasObservation: boolean, latestObservationKm: number|null, device: object|null, position: object|null }} evidence
 */
export function resolveOdometerFromEvidence(evidence) {
  const freshness = validateTelemetryFreshness({
    device: evidence.device,
    position: evidence.position,
  });

  // Unit-mismatch check runs before reset detection so both reset detection
  // and resolution compare against a km-scale value, not a possibly
  // mis-unit'd raw one.
  const unit = detectUnitMismatch(
    evidence.telemetryAttribute,
    evidence.telemetryKm,
    evidence.anchor?.anchorKm ?? null,
  );

  const reset = detectResetSuspected(
    evidence.anchor?.anchorTelemetryKm ?? null,
    unit.correctedKm,
  );

  const anchor = evidence.anchor ?? null;
  const acceptance = evidence.acceptance ?? null;
  const baselinePending = Boolean(anchor) && anchor.anchorTelemetryKm == null;

  const diagnostics = [
    ...freshness.diagnostics,
    ...reset.diagnostics,
    ...unit.diagnostics,
    ...(anchor?.deviceMismatch ? ['anchor_device_mismatch'] : (baselinePending ? ['baseline_pending'] : [])),
    ...(acceptance?.quarantined ? ['reading_quarantined'] : []),
    // informational only: the ingest has not met this tracker yet, so its raw counter is used as before
    ...(acceptance && acceptance.source !== 'accepted' && evidence.telemetryKm != null ? ['counter_unvalidated'] : []),
  ];

  const { odometerKm, resolutionMode } = resolveOdometerKm({
    anchorKm: evidence.anchor?.anchorKm ?? null,
    anchorTelemetryKm: evidence.anchor?.anchorTelemetryKm ?? null,
    currentTelemetryKm: unit.correctedKm,
  });

  const { driftPct, driftClass } = calculateDrift(
    odometerKm,
    evidence.latestObservationKm,
  );

  const confidence = scoreConfidence({
    odometerKm,
    resolutionMode,
    driftClass,
    diagnostics,
    hasObservation: evidence.hasObservation,
  });

  return {
    odometerKm,
    odometerConfidence: confidence,
    odometerDriftPct: driftPct,
    odometerDriftClass: driftClass,
    resolutionMode,
    diagnostics,
    // Unit-corrected raw telemetry (km). Distance-over-a-window consumers
    // (daily mileage) must diff THIS, not odometerKm: the anchored mode
    // clamps readings below the anchor point (M2 §7), which flattens any
    // window that spans or precedes an anchor capture to zero distance.
    telemetryKm: unit.correctedKm ?? null,
    // Additive fields: who vouches for the value, and where the baseline stands. Existing consumers
    // read only the fields above; these let a screen say "estimated", "provisional" or "awaiting tracker".
    verification: describeVerification(anchor, odometerKm),
    reconciliation: describeReconciliation(anchor, baselinePending),
    baselinePending,
    readingStatus: describeReadingStatus(acceptance, evidence.telemetryKm),
    // When the evidence behind the figure was taken: the accepted reading's time when the ingest knows this
    // tracker, otherwise the latest position's. NOT the newest raw fix when a reading is being held out.
    evidenceAt: describeEvidenceAt(acceptance, evidence),
    anchorId: anchor?.anchorId ?? null,
    anchorState: anchor?.anchorState ?? null,
    anchorObservedAt: anchor?.anchoredAt ?? null,
  };
}

/**
 * Vehicle Odometer Engine — single resolution cycle (M2 §3).
 * @param {{ merged: object, deviceId: number|null }}
 */
export async function resolveVehicleOdometer({ merged, deviceId }) {
  const evidence = await collectEvidence({ merged, deviceId });
  return resolveOdometerFromEvidence(evidence);
}

export default { resolveVehicleOdometer };

/**
 * Resolve odometer by Traccar device id (fuel prefill, maintenance adapter).
 */
export async function resolveOdometerForDevice(deviceId) {
  if (deviceId == null) {
    return {
      odometerKm: null,
      odometerConfidence: 'unavailable',
      odometerDriftPct: null,
      odometerDriftClass: 'unknown',
      resolutionMode: 'unavailable',
      diagnostics: [],
    };
  }
  return resolveVehicleOdometer({
    merged: { position: null, device: null },
    deviceId: Number(deviceId),
  });
}
