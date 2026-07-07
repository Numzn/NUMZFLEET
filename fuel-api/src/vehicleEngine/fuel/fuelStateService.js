import { REFUEL_PAIRING_LOOKBACK } from './fuelLearningConfig.js';
import { MATURITY_STATES } from './fuelModelMaturity.js';
import {
  isConfirmedFull,
  isConfirmedPartial,
  isUnknownFill,
  getAnchorClassificationSource,
  resolveReplayFillKind,
  FILL_CLASSIFICATION,
} from './fuelFillClassification.js';

/**
 * Fuel State Service — Digital Fuel Twin v0.1 (shadow mode).
 *
 * Read-only modelled tank balance: replays trusted refuel evidence since the last
 * reliable full-tank anchor against authoritative odometer movement, using the
 * existing approved efficiency hierarchy (learned → measured → spec).
 *
 * Ownership boundary: Odometer Engine owns distance; Fuel Learning owns consumption
 * behaviour; Fuel Model owns maturity + envelope; this service owns the modelled
 * current tank balance. It never writes, never influences Fueling Day, Prediction,
 * or Suggestion engines, and never replaces telemetry `litresRemaining`.
 */

export const PROJECTION_MODE = 'shadow';

/**
 * v0.2 replay trust policy (Increment 4). Post-anchor events replay when
 * fillClassification is explicitly FULL or PARTIAL. UNKNOWN events fail closed.
 */
export const PARTIAL_EVENT_POLICY = 'explicit';

export const PROJECTION_QUALITY = {
  LIMITED: 'limited',
  MODERATE: 'moderate',
  STRONG: 'strong',
  DEGRADED: 'degraded',
};

/** Odometer capture confidences trusted for anchors — same categorical semantics as intervalValidator. */
const TRUSTED_ANCHOR_ODOMETER_CONFIDENCE = new Set(['high', 'medium']);

const round1 = (value) => Math.round(Number(value) * 10) / 10;

/** Refuel prefill defaults mileage to 0 when telemetry is missing, so 0 means "not captured". */
function usableMileage(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Explicit reusable anchor reliability check. A reliable Fuel State anchor requires:
 * - operator-confirmed full tank (explicit FULL or legacy isFullTank=true)
 * - dispensed litres recorded
 * - a usable captured mileage
 * - odometer capture confidence that existing interval semantics trust (high/medium)
 */
export function isReliableFuelStateAnchor(refuel) {
  if (!refuel) return false;
  if (!isConfirmedFull(refuel)) return false;
  const litres = Number(refuel.actualFuelLitres);
  if (!Number.isFinite(litres) || litres <= 0) return false;
  if (usableMileage(refuel.currentMileage) == null) return false;
  const confidence = refuel.odometerConfidenceAtCapture ?? 'unavailable';
  return TRUSTED_ANCHOR_ODOMETER_CONFIDENCE.has(confidence);
}

function eventTimeMs(refuel) {
  const captured = refuel?.capturedAt ? new Date(refuel.capturedAt).getTime() : NaN;
  if (Number.isFinite(captured)) return captured;
  const session = refuel?.sessionDate ? new Date(refuel.sessionDate).getTime() : NaN;
  if (Number.isFinite(session)) return session;
  return 0;
}

/**
 * Deterministic replay order: strongest actual completion timestamp first
 * (capturedAt → sessionDate fallback), stable refuel-id tie-break. Multiple
 * events can share an operational date, so sessionDate alone is not enough.
 */
export function sortRefuelsDeterministically(rows) {
  return [...(rows || [])].sort((a, b) => {
    const dt = eventTimeMs(a) - eventTimeMs(b);
    if (dt !== 0) return dt;
    return Number(a?.id ?? 0) - Number(b?.id ?? 0);
  });
}

/**
 * Pure ordered replay core — no I/O. Starts from a confirmed full tank and
 * replays movement + refuel events in the given order, then depletes to the
 * live odometer. Halts (replayable: false) rather than fabricate distance,
 * guess event position, or silently correct backwards odometers.
 *
 * @param {{
 *   anchor: object,
 *   events?: object[],
 *   liveOdometerKm: number|null,
 *   tankCapacityL: number,
 *   efficiencyKmL: number,
 * }} input
 */
export function replayFuelState({
  anchor,
  events = [],
  liveOdometerKm,
  tankCapacityL,
  efficiencyKmL,
}) {
  const diagnostics = [];
  const calibrationOpportunities = [];

  const capacity = Number(tankCapacityL);
  const efficiency = Number(efficiencyKmL);
  const anchorMileage = usableMileage(anchor?.currentMileage);

  let balance = capacity;
  let previousMileage = anchorMileage;
  let partialLitresAdded = 0;
  let fullRecalibrationCount = 0;
  let ambiguousEventCount = 0;
  let trustedPartialCount = 0;
  let unknownFillCount = 0;
  let replayedRefuelCount = 0;
  let rawBelowZero = false;
  let rawAboveCapacity = false;

  const halted = (code, extra = {}) => ({
    replayable: false,
    haltReason: code,
    diagnostics: [...diagnostics, { code, ...extra }],
    calibrationOpportunities,
    partialLitresAdded,
    replayedRefuelCount,
    fullRecalibrationCount,
    ambiguousEventCount,
    trustedPartialCount,
    unknownFillCount,
    rawBelowZero,
    rawAboveCapacity,
  });

  if (!Number.isFinite(capacity) || capacity <= 0) return halted('tank_capacity_unavailable');
  if (!Number.isFinite(efficiency) || efficiency <= 0) return halted('efficiency_unavailable');
  if (anchorMileage == null) return halted('anchor_mileage_unavailable');

  balance = capacity;
  previousMileage = anchorMileage;

  for (const event of events) {
    const eventMileage = usableMileage(event?.currentMileage);
    if (eventMileage == null) {
      // Fuel-changing event at an unknown distance — replay order in distance is
      // unknowable, so the whole projection is untrustworthy. Hard stop.
      return halted('ambiguous_replay_boundary', { refuelId: event?.id ?? null });
    }

    const distanceKm = eventMileage - previousMileage;
    if (distanceKm < 0) {
      return halted('odometer_backwards', { refuelId: event?.id ?? null });
    }

    const rawBalance = balance - distanceKm / efficiency;
    if (rawBalance < 0) {
      rawBelowZero = true;
      diagnostics.push({ code: 'raw_balance_below_zero', refuelId: event?.id ?? null, rawBalance: round1(rawBalance) });
    }
    let working = Math.min(Math.max(rawBalance, 0), capacity);

    const fillKind = resolveReplayFillKind(event);
    if (fillKind === 'full') {
      const predictedBalanceBeforeFill = working;
      const predictedLitresNeededToFull = capacity - predictedBalanceBeforeFill;
      const actual = Number(event.actualFuelLitres);
      calibrationOpportunities.push({
        refuelId: event?.id ?? null,
        eventAt: event?.capturedAt ?? event?.sessionDate ?? null,
        fillClassification: event?.fillClassification ?? FILL_CLASSIFICATION.FULL,
        predictedBalanceBeforeFill: round1(predictedBalanceBeforeFill),
        predictedLitresNeededToFull: round1(predictedLitresNeededToFull),
        actualFuelLitres: Number.isFinite(actual) ? round1(actual) : null,
        calibrationErrorLitres: Number.isFinite(actual)
          ? round1(predictedLitresNeededToFull - actual)
          : null,
      });
      working = capacity;
      fullRecalibrationCount += 1;
    } else if (fillKind === 'partial') {
      const litres = Number(event.actualFuelLitres);
      if (Number.isFinite(litres) && litres > 0) {
        const rawAfterAdd = working + litres;
        if (rawAfterAdd > capacity) {
          rawAboveCapacity = true;
          diagnostics.push({ code: 'raw_balance_above_capacity', refuelId: event?.id ?? null, rawBalance: round1(rawAfterAdd) });
        }
        working = Math.min(rawAfterAdd, capacity);
        partialLitresAdded += litres;
        trustedPartialCount += 1;
      } else {
        ambiguousEventCount += 1;
        diagnostics.push({ code: 'ambiguous_fill_state', refuelId: event?.id ?? null });
      }
    } else {
      unknownFillCount += 1;
      ambiguousEventCount += 1;
      diagnostics.push({ code: 'unknown_fill_classification', refuelId: event?.id ?? null });
      return halted('unknown_fill_after_anchor', { refuelId: event?.id ?? null });
    }

    balance = working;
    previousMileage = eventMileage;
    replayedRefuelCount += 1;
  }

  const liveKm = usableMileage(liveOdometerKm);
  if (liveKm == null) return halted('live_odometer_unavailable');

  const finalDistanceKm = liveKm - previousMileage;
  if (finalDistanceKm < 0) return halted('odometer_backwards');

  const rawFinalBalance = balance - finalDistanceKm / efficiency;
  if (rawFinalBalance < 0) {
    rawBelowZero = true;
    diagnostics.push({ code: 'raw_balance_below_zero', rawBalance: round1(rawFinalBalance) });
  }
  const modelledLitresRemaining = Math.min(Math.max(rawFinalBalance, 0), capacity);
  const distanceSinceAnchorKm = liveKm - anchorMileage;

  return {
    replayable: true,
    haltReason: null,
    modelledLitresRemaining,
    rawFinalBalance,
    currentMileageKm: liveKm,
    distanceSinceAnchorKm,
    consumedLitresEstimate: distanceSinceAnchorKm / efficiency,
    partialLitresAdded,
    replayedRefuelCount,
    fullRecalibrationCount,
    ambiguousEventCount,
    trustedPartialCount,
    unknownFillCount,
    rawBelowZero,
    rawAboveCapacity,
    calibrationOpportunities,
    diagnostics,
  };
}

/**
 * Descriptive projection quality — provenance categories only, no numeric confidence.
 * Availability is decided elsewhere; this only labels how much to trust an
 * available projection.
 */
export function deriveProjectionQuality({
  efficiencySource,
  modelMaturity = null,
  replay = null,
  liveOdometerConfidence = null,
}) {
  const replayAnomalies = Boolean(
    replay && ((replay.ambiguousEventCount ?? 0) > 0 || replay.rawBelowZero || replay.rawAboveCapacity),
  );
  if (replayAnomalies) return PROJECTION_QUALITY.DEGRADED;
  if (modelMaturity === MATURITY_STATES.SHIFT_SUSPECTED) return PROJECTION_QUALITY.DEGRADED;
  if (liveOdometerConfidence === 'low') return PROJECTION_QUALITY.DEGRADED;

  if (
    efficiencySource === 'learned'
    && (modelMaturity === MATURITY_STATES.MATURE || modelMaturity === MATURITY_STATES.RECALIBRATING)
  ) {
    return PROJECTION_QUALITY.STRONG;
  }

  if (efficiencySource === 'measured' || modelMaturity === MATURITY_STATES.STABILIZING) {
    return PROJECTION_QUALITY.MODERATE;
  }

  return PROJECTION_QUALITY.LIMITED;
}

function emptyProjection(modelMaturity) {
  return {
    available: false,
    modelledLitresRemaining: null,
    estimatedSpaceLitres: null,
    tankCapacityLitres: null,
    tankCapacitySource: null,
    anchorRefuelId: null,
    anchorAt: null,
    anchorMileageKm: null,
    currentMileageKm: null,
    distanceSinceAnchorKm: null,
    consumedLitresEstimate: null,
    partialLitresAdded: null,
    efficiencyKmL: null,
    efficiencySource: null,
    modelMaturity: modelMaturity ?? null,
    projectionMode: PROJECTION_MODE,
    projectionQuality: null,
    source: 'unavailable',
    replayedRefuelCount: 0,
    fullRecalibrationCount: 0,
    ambiguousEventCount: 0,
    calibrationOpportunities: [],
    diagnostics: [],
    evidence: null,
  };
}

/**
 * Read-only observation metadata — no accuracy claim, no persistence.
 */
export function buildEvidenceObservation({
  anchor = null,
  replay = null,
  postAnchorEvents = [],
} = {}) {
  const anchorSource = anchor ? getAnchorClassificationSource(anchor) : null;
  const anchorClassification = anchorSource === 'legacy_confirmed_full'
    ? FILL_CLASSIFICATION.FULL
    : (anchor?.fillClassification ?? FILL_CLASSIFICATION.UNKNOWN);

  const unknownInPostAnchor = postAnchorEvents.filter((e) => isUnknownFill(e) && !isConfirmedFull(e)).length;
  const trustedPartialsInPostAnchor = postAnchorEvents.filter((e) => isConfirmedPartial(e)).length;

  return {
    anchorClassification,
    anchorClassificationSource: anchorSource,
    trustedPartialCount: replay?.trustedPartialCount ?? trustedPartialsInPostAnchor,
    unknownFillCount: replay?.unknownFillCount ?? unknownInPostAnchor,
    replayBlockedByUnknown: Boolean(
      replay?.haltReason === 'unknown_fill_after_anchor'
      || unknownInPostAnchor > 0,
    ),
  };
}

/** Default I/O dependencies, loaded lazily so pure unit tests never touch DB modules. */
async function loadDefaultDeps() {
  const [repo, odometer, spec, snapshot] = await Promise.all([
    import('../../repositories/operationSessionRefuelRepository.js'),
    import('../odometer/resolveVehicleOdometer.js'),
    import('../../services/vehicleSpecService.js'),
    import('./fuelSnapshotBuilder.js'),
  ]);
  return {
    loadRefuels: repo.findCompletedRefuelsByVehicleId,
    resolveOdometer: odometer.resolveOdometerForDevice,
    loadSpec: spec.getVehicleSpec,
    resolveEfficiency: snapshot.resolveEfficiencySource,
  };
}

/**
 * Shadow-mode Fuel State projection for one device.
 *
 * @param {{
 *   deviceId: number|null,
 *   learning?: object|null,        — loadFuelLearningState() result (modelMaturity etc.)
 *   hubFuel?: object|null,         — hub.fuel facts for resolveEfficiencySource
 *   specEfficiency?: number|null,  — spec km/L fallback for resolveEfficiencySource
 * }} input
 * @param {{ loadRefuels?, resolveOdometer?, loadSpec?, resolveEfficiency? }} deps — injectable for tests
 */
export async function projectFuelState(
  {
    deviceId,
    learning = null,
    hubFuel = null,
    specEfficiency = null,
  },
  deps = {},
) {
  const projection = emptyProjection(learning?.modelMaturity);

  if (deviceId == null) {
    projection.diagnostics.push({ code: 'device_unavailable' });
    return projection;
  }

  const resolved = (deps.loadRefuels && deps.resolveOdometer && deps.loadSpec && deps.resolveEfficiency)
    ? deps
    : { ...(await loadDefaultDeps()), ...deps };

  const rows = await resolved.loadRefuels(Number(deviceId), REFUEL_PAIRING_LOOKBACK);
  const ordered = sortRefuelsDeterministically(rows);

  let anchor = null;
  let anchorIndex = -1;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (isReliableFuelStateAnchor(ordered[i])) {
      anchor = ordered[i];
      anchorIndex = i;
      break;
    }
  }

  if (!anchor) {
    projection.diagnostics.push({ code: 'no_reliable_anchor', refuelsConsidered: ordered.length });
    return projection;
  }

  projection.anchorRefuelId = Number(anchor.id);
  const anchorAt = anchor.capturedAt ?? anchor.sessionDate ?? null;
  projection.anchorAt = anchorAt ? new Date(anchorAt).toISOString() : null;
  projection.anchorMileageKm = Number(anchor.currentMileage);

  const postAnchorEvents = ordered.slice(anchorIndex + 1);
  projection.evidence = buildEvidenceObservation({ anchor, postAnchorEvents });

  let tankCapacityLitres = Number(anchor.tankCapacitySnapshot);
  let tankCapacitySource = 'anchor_snapshot';
  if (!Number.isFinite(tankCapacityLitres) || tankCapacityLitres <= 0) {
    const spec = await resolved.loadSpec(Number(deviceId));
    tankCapacityLitres = Number(spec?.tankCapacity);
    tankCapacitySource = 'vehicle_spec';
  }
  if (!Number.isFinite(tankCapacityLitres) || tankCapacityLitres <= 0) {
    projection.diagnostics.push({ code: 'tank_capacity_unavailable' });
    return projection;
  }
  projection.tankCapacityLitres = tankCapacityLitres;
  projection.tankCapacitySource = tankCapacitySource;

  const efficiency = resolved.resolveEfficiency({ hubFuel, learning, specEfficiency });
  if (efficiency.efficiencySource === 'none' || !(Number(efficiency.efficiencyKmL) > 0)) {
    projection.diagnostics.push({ code: 'efficiency_unavailable' });
    return projection;
  }
  projection.efficiencyKmL = Number(efficiency.efficiencyKmL);
  projection.efficiencySource = efficiency.efficiencySource;

  const liveOdometer = await resolved.resolveOdometer(Number(deviceId));
  if (liveOdometer?.odometerKm == null) {
    projection.diagnostics.push({ code: 'live_odometer_unavailable' });
    return projection;
  }

  const replay = replayFuelState({
    anchor,
    events: postAnchorEvents,
    liveOdometerKm: liveOdometer.odometerKm,
    tankCapacityL: tankCapacityLitres,
    efficiencyKmL: projection.efficiencyKmL,
  });

  projection.evidence = buildEvidenceObservation({ anchor, replay, postAnchorEvents });

  if (!replay.replayable) {
    projection.diagnostics.push(...replay.diagnostics);
    if (replay.haltReason === 'unknown_fill_after_anchor') {
      projection.diagnostics.push({
        code: 'replay_blocked_by_unknown_fill',
        policy: PARTIAL_EVENT_POLICY,
      });
    }
    return projection;
  }

  projection.available = true;
  projection.source = 'model';
  projection.modelledLitresRemaining = round1(replay.modelledLitresRemaining);
  projection.estimatedSpaceLitres = round1(tankCapacityLitres - replay.modelledLitresRemaining);
  projection.currentMileageKm = round1(replay.currentMileageKm);
  projection.distanceSinceAnchorKm = round1(replay.distanceSinceAnchorKm);
  projection.consumedLitresEstimate = round1(replay.consumedLitresEstimate);
  projection.partialLitresAdded = round1(replay.partialLitresAdded);
  projection.replayedRefuelCount = replay.replayedRefuelCount;
  projection.fullRecalibrationCount = replay.fullRecalibrationCount;
  projection.ambiguousEventCount = replay.ambiguousEventCount;
  projection.calibrationOpportunities = replay.calibrationOpportunities;
  projection.diagnostics.push(...replay.diagnostics);
  projection.projectionQuality = deriveProjectionQuality({
    efficiencySource: projection.efficiencySource,
    modelMaturity: projection.modelMaturity,
    replay,
    liveOdometerConfidence: liveOdometer.odometerConfidence ?? null,
  });

  return projection;
}

export default {
  PROJECTION_MODE,
  PARTIAL_EVENT_POLICY,
  PROJECTION_QUALITY,
  isReliableFuelStateAnchor,
  sortRefuelsDeterministically,
  replayFuelState,
  deriveProjectionQuality,
  buildEvidenceObservation,
  projectFuelState,
};
