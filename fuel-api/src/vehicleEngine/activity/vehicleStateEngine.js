import { evaluateStateTransition as engineEvaluateStateTransition } from '../state/index.js';
import { fetchDeviceEvents } from './fetchActivityEvidence.js';

const RECONSTRUCT_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const EVENT_TYPE_FOR_STATE = {
  moving: 'devicemoving',
  idle: 'devicestopped',
};

/**
 * When a transition is newly detected, find when it actually happened
 * instead of stamping "now" — a vehicle that's been moving for 5 hours must
 * not show "moving · 30s" just because this is the first evaluation since a
 * restart or a long gap between evaluations.
 *
 * Unchanged reconstruction algorithm. Now injected into the VehicleStateEngine
 * (../state/) as its resolveTransitionTimestamp callback, per
 * docs/architecture/vehicle-state-engine.md ("Transition detection and
 * ownership") — the engine itself stays pure/I/O-free and never imports this.
 */
async function resolveStateEnteredAt({ deviceId, state, deviceLastUpdate, now }) {
  if (state === 'offline') {
    return { at: deviceLastUpdate ? new Date(deviceLastUpdate) : new Date(now), source: 'observed' };
  }

  const eventType = EVENT_TYPE_FOR_STATE[state];
  if (eventType && deviceId != null) {
    try {
      // DESC: the closest matching event to `now`, not the oldest one within
      // the truncated top of a 48h window — a busy device easily has more
      // than 50 events in that window, and ASC + take-last would silently
      // return an arbitrarily old match once truncation kicks in.
      const events = await fetchDeviceEvents({
        deviceId,
        from: new Date(now - RECONSTRUCT_LOOKBACK_MS),
        to: new Date(now),
        limit: 50,
        order: 'DESC',
      });
      const latest = events.find((e) => String(e.type || '').toLowerCase() === eventType);
      if (latest?.occurredAt) {
        return { at: new Date(latest.occurredAt), source: 'reconstructed' };
      }
    } catch {
      /* fall through to observed */
    }
  }

  return { at: new Date(now), source: 'observed' };
}

/**
 * Sole owner of activity-state classification/transition decisions — now a
 * thin adapter over the VehicleStateEngine (../state/): classification and
 * transition-comparison logic lives there (tested independently in
 * VehicleStateEngine.test.js), this function only adapts its
 * {snapshot, transition, metadata} shape back to the flat
 * {state, stateEnteredAt, stateSource, changed} contract every caller
 * already expects, and injects the one genuinely I/O-dependent piece
 * (resolveStateEnteredAt) as a callback.
 *
 * Both the lazy batch path (activityStateService) and the event-driven
 * ingestion path call this — no state logic should exist anywhere else.
 *
 * @param {{ vehicleId: string, deviceId: number|null, deviceStatus: string|null,
 *   deviceLastUpdate: string|Date|null, positionSpeed: number|null,
 *   existing: { state: string, stateEnteredAt: Date, stateSource: string }|null,
 *   now?: number, forceRebuild?: boolean }} input
 * @returns {Promise<{ state: string, stateEnteredAt: Date, stateSource: string, changed: boolean }>}
 */
export async function evaluateStateTransition({
  vehicleId,
  deviceId,
  deviceStatus,
  deviceLastUpdate,
  positionSpeed,
  existing,
  now = Date.now(),
  forceRebuild = false,
}) {
  const telemetry = {
    vehicleId, deviceId, deviceStatus, deviceLastUpdate, positionSpeed, now,
  };
  // forceRebuild bypasses the "unchanged, reuse existing" short-circuit by
  // presenting this evaluation as if there were no previous record at all —
  // the engine then always resolves a fresh stateEnteredAt via the injected
  // callback below, even when the classified state happens to still match
  // what was persisted (used when a health check flags the persisted
  // timestamp itself as implausible, not the state).
  const previousState = (existing && !forceRebuild)
    ? { state: existing.state, stateEnteredAt: existing.stateEnteredAt, stateSource: existing.stateSource }
    : null;

  const result = await engineEvaluateStateTransition(telemetry, previousState, {
    resolveTransitionTimestamp: resolveStateEnteredAt,
  });

  return {
    state: result.snapshot.state,
    stateEnteredAt: new Date(result.snapshot.enteredAt),
    stateSource: result.snapshot.confidence,
    changed: forceRebuild || result.transition !== null || result.metadata.initialObservation,
    // Additive field — existing callers destructure only the four fields
    // above and are unaffected. Used by evaluateAndHeal.js to decide whether
    // a health-check-triggered forced repair is needed.
    issues: result.snapshot.issues,
  };
}
