import { normalizePositionTelemetry } from './telemetryUtils.js';

const MOTION_LABELS = { moving: 'Moving', idle: 'Idle', offline: 'Offline' };

/**
 * Status tint key for fleet UI (moving / idle / offline) — derived entirely
 * from the canonical, backend-persisted activity state (see
 * fuel-api/src/vehicleEngine/activity/resolveActivityState.js). No local
 * recomputation from device.status/position.speed here anymore — every
 * consumer of this file reads the same resolved value.
 * @param {{ state: 'moving'|'idle'|'offline' }|null} activityState
 */
export function getVehicleStatusKey(activityState) {
  return activityState?.state ?? 'offline';
}

/** Human label for the same canonical state. */
export function getMotionLabel(activityState) {
  return MOTION_LABELS[activityState?.state] ?? 'Offline';
}

/** Short ignition phrase when online; null if unknown. */
export function getIgnitionPhrase(positionAttributes) {
  const { ignition } = normalizePositionTelemetry(positionAttributes || null);
  if (ignition === true || ignition === 'true' || ignition === 1 || ignition === '1') return 'Ignition ON';
  if (ignition === false || ignition === 'false' || ignition === 0 || ignition === '0') return 'Ignition OFF';
  return null;
}

function formatMotionDuration(ms) {
  if (ms == null || ms < 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

/**
 * How long the vehicle has held its current activity state. Backed by
 * `activityState.stateEnteredAt`, which the backend persists and only
 * updates on an actual detected transition (reconstructed from Traccar's
 * event log when possible, not stamped "now" on every read) — a vehicle
 * moving for 5 hours no longer shows "Idle 1m" just because this is the
 * first time this session evaluated it.
 * @param {{ stateEnteredAt: string|Date }|null} activityState
 */
export function getMotionDurationLabel(activityState, now = Date.now()) {
  if (!activityState?.stateEnteredAt) return null;
  const since = new Date(activityState.stateEnteredAt).getTime();
  if (!Number.isFinite(since)) return null;
  return formatMotionDuration(now - since);
}
