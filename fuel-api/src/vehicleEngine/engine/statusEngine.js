export function buildStatusEngine(registry, telemetryHub) {
  const hasTracker = Boolean(registry?.assignment?.deviceId);
  const online = telemetryHub?.online ?? false;
  const moving = telemetryHub?.moving ?? false;

  let operational = 'no_tracker';
  if (hasTracker) {
    operational = online ? 'available' : 'offline';
  }

  return { operational, moving, online, hasTracker };
}
