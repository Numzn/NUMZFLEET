function resolveOdometerKm(position) {
  if (!position?.telemetry) return null;
  const meters = Number(position.telemetry.totalDistance);
  if (!Number.isFinite(meters)) return null;
  return Math.round(meters / 1000);
}

function isOnline(device) {
  if (!device) return false;
  if (device.status === 'online') return true;
  if (!device.lastUpdate) return false;
  const last = new Date(device.lastUpdate).getTime();
  return Date.now() - last < 5 * 60 * 1000;
}

export function buildTelemetryHub(merged) {
  const position = merged?.position ?? null;
  const device = merged?.device ?? null;
  const speed = position?.speed != null ? Number(position.speed) : null;

  return {
    position,
    telemetry: position?.telemetry ?? null,
    odometerKm: resolveOdometerKm(position),
    online: isOnline(device),
    lastUpdate: device?.lastUpdate ?? position?.fixTime ?? null,
    speedKph: speed,
    moving: speed != null && speed > 1,
  };
}
