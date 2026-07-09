/** GPS data older than this (ms) while device is online → “stale fix” chip */
export const STALE_FIX_MS = 25 * 60 * 1000;

/**
 * Rule-based operational chips for fleet list cards (geofence/fuel hooks later).
 * @param {object} device
 * @param {object} [position]
 * @returns {{ key: string, label: string, color: 'default'|'warning'|'error'|'success'|'info' }[]}
 */
export default function getOperationalIndicators(device, position) {
  const indicators = [];

  if (device?.status === 'offline') {
    indicators.push({ key: 'offline', label: 'Offline', color: 'default' });
  }

  const fixTime = position?.fixTime;
  if (fixTime && device?.status === 'online') {
    const age = Date.now() - new Date(fixTime).getTime();
    if (age > STALE_FIX_MS) {
      indicators.push({ key: 'stale', label: 'Stale fix', color: 'warning' });
    }
  }

  const limit = device?.attributes?.speedLimit;
  if (limit != null && position != null && Number(position.speed) > Number(limit)) {
    indicators.push({ key: 'overspeed', label: 'Overspeed', color: 'error' });
  }

  return indicators;
}
