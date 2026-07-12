import { resolveActivityState } from './resolveActivityState.js';
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
 * Sole owner of activity-state classification/transition decisions. Both the
 * lazy batch path (activityStateService) and the event-driven ingestion path
 * call this — no state logic should exist anywhere else.
 *
 * @param {{ vehicleId: string, deviceId: number|null, deviceStatus: string|null,
 *   deviceLastUpdate: string|Date|null, positionSpeed: number|null,
 *   existing: { state: string, stateEnteredAt: Date, stateSource: string }|null,
 *   now?: number }} input
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
}) {
  const state = resolveActivityState({ deviceStatus, deviceLastUpdate, positionSpeed, now });

  if (existing && existing.state === state) {
    return {
      state,
      stateEnteredAt: existing.stateEnteredAt,
      stateSource: existing.stateSource,
      changed: false,
    };
  }

  const resolved = await resolveStateEnteredAt({ deviceId, state, deviceLastUpdate, now });
  return {
    state,
    stateEnteredAt: resolved.at,
    stateSource: resolved.source,
    changed: true,
  };
}
