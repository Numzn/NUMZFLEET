import { resolveActivityState } from '../activity/resolveActivityState.js';
import { calculateDuration } from './DurationCalculator.js';
import { evaluateVehicleHealth } from './VehicleHealthEvaluator.js';
import { buildVehicleStateSnapshot } from './VehicleStateSnapshot.js';

/**
 * Single backend owner of "what is this vehicle's current operational
 * state" AND of transition detection ("has it changed since we last
 * looked?"). Wraps the canonical resolveActivityState() resolver —
 * unchanged, still the one algorithm for moving/idle/offline classification
 * — and adds duration, confidence, health, and (via evaluateStateTransition)
 * transition detection as consistent, single-owner concepts, so consumers
 * stop recomputing these independently (see docs/architecture/vehicle-state-engine.md).
 *
 * Does NOT persist anything and does NOT touch Sequelize, Traccar MySQL, or
 * any other I/O — activityStateService.js (the persistence adapter) is the
 * only caller that loads/writes vehicle_activity_state; this module stays a
 * pure, dependency-free comparison of whatever previousState it's handed
 * against a freshly-resolved current state.
 *
 * Public exports: buildVehicleState(), evaluateStateTransition(). Everything
 * else in this directory is an internal implementation detail.
 *
 * @param {{
 *   vehicleId?: string|null,
 *   deviceId?: number|null,
 *   deviceStatus?: string|null,
 *   deviceLastUpdate?: string|Date|null,
 *   positionSpeed?: number|null,
 *   positionFixTime?: string|Date|null,
 *   now?: number,
 * }} telemetry
 * @param {{ state: string, stateEnteredAt: string|Date, stateSource?: string }|null} [persistedState]
 *   The existing vehicle_activity_state row for this vehicle, if the caller
 *   has one on hand (e.g. from a merged Vehicle DTO). Optional — omit for a
 *   pure live evaluation with no duration/confidence beyond 'unknown'.
 */
export function buildVehicleState(telemetry = {}, persistedState = null) {
  const now = telemetry.now ?? Date.now();

  // Canonical resolver — unchanged algorithm, same function used everywhere
  // else in the codebase.
  const state = resolveActivityState({
    deviceStatus: telemetry.deviceStatus ?? null,
    deviceLastUpdate: telemetry.deviceLastUpdate ?? null,
    positionSpeed: telemetry.positionSpeed ?? null,
    now,
  });

  const { enteredAt, durationSeconds, agrees } = calculateDuration({
    liveState: state,
    persistedState,
    now,
  });

  // Reuse the persisted record's own stateSource ('observed'/'reconstructed')
  // when it's still trustworthy; otherwise we have no basis for a duration
  // claim at all.
  const confidence = agrees ? (persistedState?.stateSource ?? 'observed') : 'unknown';

  const telemetrySnapshot = {
    deviceStatus: telemetry.deviceStatus ?? null,
    deviceLastUpdate: telemetry.deviceLastUpdate ?? null,
    positionSpeed: telemetry.positionSpeed ?? null,
    positionFixTime: telemetry.positionFixTime ?? null,
  };

  const health = evaluateVehicleHealth({
    state,
    telemetry: telemetrySnapshot,
    confidence,
    enteredAt,
    durationSeconds,
    now,
  });

  return buildVehicleStateSnapshot({
    vehicleId: telemetry.vehicleId ?? null,
    deviceId: telemetry.deviceId ?? null,
    state,
    enteredAt,
    durationSeconds,
    confidence,
    health: health.status,
    issues: health.issues,
    telemetry: telemetrySnapshot,
  });
}

/**
 * Simple, deterministic transition reasons — derived only from values the
 * canonical classifier already produces (no invented signals, e.g. ignition
 * is not part of resolveActivityState()'s classification, so it can't be a
 * reason here).
 */
function deriveTransitionReason(previousStateValue, currentState) {
  if (currentState === 'offline') return 'heartbeat_timeout';
  if (previousStateValue === 'offline') return 'heartbeat_resumed';
  return 'speed_changed';
}

/**
 * The engine's transition-detection entry point — the only place in the
 * codebase that compares a previous state to a current one. Given telemetry
 * and whatever previousState a caller has on hand, resolves the current
 * state (via resolveActivityState(), unchanged) and decides whether a
 * transition happened.
 *
 * "First observation" (no previousState at all) is explicitly NOT modeled
 * as a transition — there is nothing to compare against, so this returns
 * `transition: null` with `metadata.initialObservation: true` rather than a
 * fabricated transition with a null previousState.
 *
 * Timestamp resolution for a genuine transition (or a first observation,
 * which also needs a fresh stateEnteredAt) is entirely the injected
 * `resolveTransitionTimestamp` callback's job — including its own handling
 * of the `offline` case. The engine deliberately does not hardcode any part
 * of that rule itself: duplicating it here would reintroduce the exact
 * "two implementations that can drift" problem this engine exists to
 * prevent. Without an injected callback, the engine falls back to a trivial
 * `now()`/'observed' default, so pure/injection-free callers (and tests)
 * still get a deterministic result with no I/O.
 *
 * @param {{
 *   vehicleId?: string|null, deviceId?: number|null, deviceStatus?: string|null,
 *   deviceLastUpdate?: string|Date|null, positionSpeed?: number|null,
 *   positionFixTime?: string|Date|null, now?: number,
 * }} telemetry
 * @param {{ state: string, stateEnteredAt: string|Date, stateSource?: string }|null} [previousState]
 * @param {{ resolveTransitionTimestamp?: (args: { deviceId, state, deviceLastUpdate, now }) => Promise<{ at: Date|string, source: string }> }} [options]
 * @returns {Promise<{
 *   snapshot: object,
 *   transition: null | { vehicleId, previousState, currentState, transitionedAt, previousEnteredAt, reason, confidence },
 *   metadata: { initialObservation: boolean },
 * }>}
 */
export async function evaluateStateTransition(telemetry = {}, previousState = null, { resolveTransitionTimestamp } = {}) {
  const now = telemetry.now ?? Date.now();
  const currentState = resolveActivityState({
    deviceStatus: telemetry.deviceStatus ?? null,
    deviceLastUpdate: telemetry.deviceLastUpdate ?? null,
    positionSpeed: telemetry.positionSpeed ?? null,
    now,
  });

  const initialObservation = !previousState;
  const stateChanged = !initialObservation && previousState.state !== currentState;

  // Nothing new to report: reuse the existing record verbatim.
  if (!initialObservation && !stateChanged) {
    const snapshot = buildVehicleState(telemetry, previousState);
    return { snapshot, transition: null, metadata: { initialObservation: false } };
  }

  // Either the first time we've ever seen this vehicle, or a genuine
  // transition — both need a fresh stateEnteredAt.
  let transitionedAt;
  let stateSource;
  if (resolveTransitionTimestamp) {
    const resolved = await resolveTransitionTimestamp({
      deviceId: telemetry.deviceId ?? null,
      state: currentState,
      deviceLastUpdate: telemetry.deviceLastUpdate ?? null,
      now,
    });
    transitionedAt = resolved.at;
    stateSource = resolved.source;
  } else {
    transitionedAt = new Date(now);
    stateSource = 'observed';
  }

  // Constructed to agree with currentState by definition, so buildVehicleState
  // always resolves a full duration/confidence for the returned snapshot.
  const snapshot = buildVehicleState(telemetry, {
    state: currentState,
    stateEnteredAt: transitionedAt,
    stateSource,
  });

  if (initialObservation) {
    return { snapshot, transition: null, metadata: { initialObservation: true } };
  }

  const transition = {
    vehicleId: telemetry.vehicleId ?? null,
    previousState: previousState.state,
    currentState,
    transitionedAt: new Date(transitionedAt).toISOString(),
    previousEnteredAt: previousState.stateEnteredAt
      ? new Date(previousState.stateEnteredAt).toISOString()
      : null,
    reason: deriveTransitionReason(previousState.state, currentState),
    confidence: stateSource,
  };

  return { snapshot, transition, metadata: { initialObservation: false } };
}
