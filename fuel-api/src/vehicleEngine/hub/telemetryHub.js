import { resolveActivityState } from '../activity/resolveActivityState.js';

export function buildTelemetryHub(merged) {
  const position = merged?.position ?? null;
  const device = merged?.device ?? null;
  const speed = position?.speed != null ? Number(position.speed) : null;

  const totalDistanceM = position?.telemetry?.totalDistance != null
    ? Number(position.telemetry.totalDistance)
    : null;

  // Canonical resolver (fuel-api/src/vehicleEngine/activity/resolveActivityState.js)
  // — the same function used everywhere else state is computed, so this hub
  // can't drift from the fleet counts or the persisted activity state.
  const state = resolveActivityState({
    deviceStatus: device?.status ?? null,
    deviceLastUpdate: device?.lastUpdate ?? null,
    positionSpeed: speed,
  });

  return {
    position,
    telemetry: position?.telemetry ?? null,
    evidence: {
      rawDistanceM: Number.isFinite(totalDistanceM) ? totalDistanceM : null,
      lastFixAt: position?.fixTime ?? null,
    },
    activityState: state,
    online: state !== 'offline',
    lastUpdate: device?.lastUpdate ?? position?.fixTime ?? null,
    speedKph: speed,
    moving: state === 'moving',
  };
}
