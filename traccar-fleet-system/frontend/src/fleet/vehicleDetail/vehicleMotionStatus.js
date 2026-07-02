import { normalizePositionTelemetry } from './telemetryUtils.js';

/** Status tint key for fleet mobile UI (moving / idle / offline). */
export function getVehicleStatusKey(device, position) {
  if (device.status !== 'online') return 'offline';
  return position && Number(position.speed) > 0 ? 'moving' : 'idle';
}

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
 * Prefers Traccar position attributes (stopTime, motionTime) when present;
 * falls back to session tracker only when telemetry lacks onset timestamps.
 */
const motionStateTracker = new Map();

function parseAttributeTimestamp(attrs, keys) {
  if (!attrs) return null;
  for (const key of keys) {
    const raw = attrs[key];
    if (raw == null || raw === '') continue;
    const ms = typeof raw === 'number' ? raw : Date.parse(String(raw));
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return null;
}

/** Resolve motion-state onset from Traccar position attributes when available. */
export function getMotionStateSinceFromAttributes(state, positionAttributes) {
  if (!positionAttributes) return null;
  if (state === 'Moving') {
    return parseAttributeTimestamp(positionAttributes, ['motionTime', 'motionStart', 'eventTime']);
  }
  if (state === 'Idle') {
    return parseAttributeTimestamp(positionAttributes, ['stopTime', 'idleTime', 'parkedTime', 'eventTime']);
  }
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
 * How long the device has held its current motion state (Moving/Idle/Offline).
 * Records the transition the first time a new state is observed and returns a
 * short human label like "45m" or "2h 14m". Returns null when device id is unknown.
 */
export function getMotionDurationLabel(
  deviceId,
  deviceStatus,
  positionSpeed,
  now = Date.now(),
  positionAttributes = null,
) {
  if (deviceId == null) return null;
  const state = getMotionLabel(deviceStatus, positionSpeed);
  const attrSince = getMotionStateSinceFromAttributes(state, positionAttributes);
  const prev = motionStateTracker.get(deviceId);
  let since;
  if (!prev || prev.state !== state) {
    since = attrSince ?? now;
    motionStateTracker.set(deviceId, { state, since });
  } else if (attrSince != null && attrSince < prev.since) {
    since = attrSince;
    motionStateTracker.set(deviceId, { state, since });
  } else {
    since = prev.since;
  }
  return formatMotionDuration(now - since);
}
