import { normalizePositionTelemetry } from './telemetryUtils.js';

/** Motion label from device connectivity + live speed (Traccar speed in knots). */
export function getMotionLabel(deviceStatus, positionSpeed) {
  if (deviceStatus !== 'online') return 'Offline';
  return positionSpeed != null && Number(positionSpeed) > 0 ? 'Moving' : 'Idle';
}

/** Short ignition phrase when online; null if unknown. */
export function getIgnitionPhrase(positionAttributes) {
  const { ignition } = normalizePositionTelemetry(positionAttributes || null);
  if (ignition === true || ignition === 'true' || ignition === 1 || ignition === '1') return 'Ignition ON';
  if (ignition === false || ignition === 'false' || ignition === 0 || ignition === '0') return 'Ignition OFF';
  return null;
}

/**
 * Session-scoped motion-state tracker: remembers when each device last changed
 * between Moving / Idle / Offline so the UI can show "Idle 2h 14m".
 * State is held in-memory for the session (resets on full page reload); good
 * enough for a live dashboard without extra API calls.
 */
const motionStateTracker = new Map();

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
 * How long the device has held its current motion state (Moving/Idle/Offline).
 * Records the transition the first time a new state is observed and returns a
 * short human label like "45m" or "2h 14m". Returns null when device id is unknown.
 */
export function getMotionDurationLabel(deviceId, deviceStatus, positionSpeed, now = Date.now()) {
  if (deviceId == null) return null;
  const state = getMotionLabel(deviceStatus, positionSpeed);
  const prev = motionStateTracker.get(deviceId);
  let since;
  if (!prev || prev.state !== state) {
    since = now;
    motionStateTracker.set(deviceId, { state, since });
  } else {
    since = prev.since;
  }
  return formatMotionDuration(now - since);
}
