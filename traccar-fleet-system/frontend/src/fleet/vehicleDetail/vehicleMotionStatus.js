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
