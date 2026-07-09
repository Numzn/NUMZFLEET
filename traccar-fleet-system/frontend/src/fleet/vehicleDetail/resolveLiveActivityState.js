/**
 * Client-side mirror of fuel-api/src/vehicleEngine/activity/resolveActivityState.js.
 *
 * The persisted `vehicle_activity_state` table is only re-evaluated when a
 * manager's browser calls GET /api/vehicles (listVehiclesMerged) — there is
 * no background job. If nobody with manager access loads that page for a
 * while, the persisted row can drift arbitrarily far from reality (confirmed
 * in production: a vehicle moving right now showed "idle" from a row over
 * 2 days stale). Redux `state.devices`/`state.session.positions` are pushed
 * live by Traccar's own WebSocket feed for every authenticated user, so
 * computing state from them directly is both more current and not gated
 * behind manager permission. Keep this logic identical to the backend
 * resolver — it's the same rule, just evaluated against live data instead
 * of a lazily-refreshed cache.
 */

const OFFLINE_FRESHNESS_MS = 5 * 60 * 1000;

/**
 * @param {{ deviceStatus: string|null, deviceLastUpdate: string|Date|null, positionSpeed: number|null, now?: number }}
 * @returns {'moving'|'idle'|'offline'}
 */
export function resolveLiveActivityState({
  deviceStatus, deviceLastUpdate, positionSpeed, now = Date.now(),
}) {
  const online = deviceStatus === 'online'
    || (deviceLastUpdate != null && (now - new Date(deviceLastUpdate).getTime()) < OFFLINE_FRESHNESS_MS);

  if (!online) return 'offline';

  const speed = positionSpeed != null ? Number(positionSpeed) : null;
  return speed != null && Number.isFinite(speed) && speed > 0 ? 'moving' : 'idle';
}
