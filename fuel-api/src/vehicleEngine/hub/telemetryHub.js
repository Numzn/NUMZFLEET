import { buildVehicleState } from '../state/index.js';

export function buildTelemetryHub(merged) {
  const position = merged?.position ?? null;
  const device = merged?.device ?? null;
  const speed = position?.speed != null ? Number(position.speed) : null;

  const totalDistanceM = position?.telemetry?.totalDistance != null
    ? Number(position.telemetry.totalDistance)
    : null;

  // Canonical engine (fuel-api/src/vehicleEngine/state/) — same
  // resolveActivityState() classification used everywhere else state is
  // computed (buildVehicleState never reimplements it, only wraps it), so
  // this hub can't drift from the fleet counts or the persisted activity
  // state. merged.activityState is already the canonical persisted snapshot
  // by the time buildTelemetryHub runs (getVehicleMerged resolves it before
  // vehicleEngineService calls this) — passing it through additionally
  // yields durationSeconds/confidence/health/issues this hub didn't
  // previously surface, at no extra I/O.
  const snapshot = buildVehicleState(
    {
      vehicleId: merged?.id ?? null,
      deviceId: device?.id ?? null,
      deviceStatus: device?.status ?? null,
      deviceLastUpdate: device?.lastUpdate ?? null,
      positionSpeed: speed,
      positionFixTime: position?.fixTime ?? null,
    },
    merged?.activityState ?? null,
  );
  const state = snapshot.state;

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
    // Additive — existing consumers destructuring only the fields above are
    // unaffected.
    durationSeconds: snapshot.durationSeconds,
    confidence: snapshot.confidence,
    health: snapshot.health,
    issues: snapshot.issues,
  };
}
