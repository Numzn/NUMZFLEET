/**
 * Canonical vehicle activity state (moving / idle / offline) — one resolver,
 * no per-consumer reimplementation. Replaces 8 previously-independent
 * implementations (telemetryHub, raw-SQL fleet counts, and 4 frontend
 * recomputations) that could disagree for the same vehicle.
 */

const OFFLINE_FRESHNESS_MS = 5 * 60 * 1000;

export const ACTIVITY_STATES = ['moving', 'idle', 'offline'];

/**
 * @param {{ deviceStatus: string|null, deviceLastUpdate: string|Date|null, positionSpeed: number|null, now?: number }}
 * @returns {'moving'|'idle'|'offline'}
 */
export function resolveActivityState({ deviceStatus, deviceLastUpdate, positionSpeed, now = Date.now() }) {
  const online = deviceStatus === 'online'
    || (deviceLastUpdate != null && (now - new Date(deviceLastUpdate).getTime()) < OFFLINE_FRESHNESS_MS);

  if (!online) return 'offline';

  const speed = positionSpeed != null ? Number(positionSpeed) : null;
  return speed != null && Number.isFinite(speed) && speed > 0 ? 'moving' : 'idle';
}
