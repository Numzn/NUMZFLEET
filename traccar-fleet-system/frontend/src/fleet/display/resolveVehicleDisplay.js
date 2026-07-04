/**
 * Canonical vehicle display labels for NumzTrak Fleet OS.
 *
 * Priority: nickname (name) → registration (plateNumber) → device.name → "Vehicle"
 * Secondary: registration when it differs from primary.
 */

function trimOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

/**
 * @param {object} input
 * @param {string} [input.name] - nickname
 * @param {string} [input.plateNumber] - registration
 * @param {string} [input.deviceName] - Traccar device name fallback
 * @param {number|string} [input.deviceId]
 * @param {string} [input.fleetVehicleId]
 * @param {number|null} [input.odometerKm] - canonical resolved odometer (fuel-api resolveOdometerKm), NOT daily mileage
 * @param {string} [input.odometerConfidence]
 * @param {object|null} [input.activityState] - canonical resolveActivityState() result, persisted server-side
 * @returns {{ primary: string, secondary: string|null, deviceId: number|null, fleetVehicleId: string|null, odometerKm: number|null, odometerConfidence: string, activityState: object|null }}
 */
export function resolveVehicleDisplay(input = {}) {
  const nickname = trimOrNull(input.name);
  const registration = trimOrNull(input.plateNumber);
  const deviceName = trimOrNull(input.deviceName);
  const deviceId = input.deviceId != null && input.deviceId !== ''
    ? Number(input.deviceId)
    : null;
  const fleetVehicleId = input.fleetVehicleId != null && input.fleetVehicleId !== ''
    ? String(input.fleetVehicleId)
    : null;

  let primary = nickname || registration || deviceName || 'Vehicle';

  let secondary = null;
  if (nickname && registration && nickname !== registration) {
    secondary = registration;
  } else if (!nickname && registration && deviceName && registration !== deviceName) {
    secondary = deviceName;
  }

  return {
    primary,
    secondary,
    deviceId: Number.isFinite(deviceId) ? deviceId : null,
    fleetVehicleId,
    odometerKm: Number.isFinite(Number(input.odometerKm)) ? Number(input.odometerKm) : null,
    odometerConfidence: input.odometerConfidence ?? 'unavailable',
    activityState: input.activityState ?? null,
  };
}

/**
 * Resolve from a fuel-api merged vehicle row.
 * @param {object|null|undefined} vehicleRow
 */
export function resolveVehicleDisplayFromFleetRow(vehicleRow) {
  if (!vehicleRow) {
    return resolveVehicleDisplay({});
  }
  return resolveVehicleDisplay({
    name: vehicleRow.name,
    plateNumber: vehicleRow.plateNumber,
    deviceName: vehicleRow.device?.name,
    deviceId: vehicleRow.assignment?.deviceId ?? vehicleRow.device?.id,
    fleetVehicleId: vehicleRow.id,
    odometerKm: vehicleRow.odometerKm,
    odometerConfidence: vehicleRow.odometerConfidence,
    activityState: vehicleRow.activityState ?? null,
  });
}

/**
 * Resolve from Traccar device + optional fleet row lookup.
 * @param {object|null|undefined} device
 * @param {object|null|undefined} [fleetRow]
 */
export function resolveVehicleDisplayFromDevice(device, fleetRow) {
  if (fleetRow) {
    return resolveVehicleDisplayFromFleetRow(fleetRow);
  }
  return resolveVehicleDisplay({
    name: device?.attributes?.vehicleName,
    deviceName: device?.name,
    deviceId: device?.id,
  });
}

/**
 * Build registry maps from fleet vehicle list.
 * @param {Array} rows
 * @returns {{ byDeviceId: Map<number, object>, byFleetVehicleId: Map<string, object> }}
 */
export function buildVehicleDisplayRegistry(rows = []) {
  const byDeviceId = new Map();
  const byFleetVehicleId = new Map();

  for (const row of rows) {
    const display = resolveVehicleDisplayFromFleetRow(row);
    if (display.fleetVehicleId) {
      byFleetVehicleId.set(display.fleetVehicleId, display);
    }
    if (display.deviceId != null) {
      byDeviceId.set(display.deviceId, display);
    }
  }

  return { byDeviceId, byFleetVehicleId };
}

/**
 * @param {Map<number, object>} registry
 * @param {number|string|null|undefined} deviceId
 * @param {object|null|undefined} [device]
 */
export function lookupVehicleDisplay(registry, deviceId, device) {
  const id = deviceId != null ? Number(deviceId) : null;
  if (registry && Number.isFinite(id) && registry.has(id)) {
    return registry.get(id);
  }
  return resolveVehicleDisplayFromDevice(device);
}

/**
 * Resolve a fleet vehicle UUID only when it exists in the live registry.
 * Ignores stale Traccar device.attributes.fleetVehicleId after delete/restore.
 *
 * @param {{ byDeviceId?: Map<number, object>, byFleetVehicleId?: Map<string, object> }} registry
 * @param {number|string|null|undefined} deviceId
 * @param {string|null|undefined} [candidateFleetVehicleId]
 */
export function resolveKnownFleetVehicleId(registry, deviceId, candidateFleetVehicleId) {
  const candidate = candidateFleetVehicleId != null && candidateFleetVehicleId !== ''
    ? String(candidateFleetVehicleId)
    : null;
  if (candidate && registry?.byFleetVehicleId?.has(candidate)) {
    return candidate;
  }
  const did = deviceId != null ? Number(deviceId) : NaN;
  if (registry?.byDeviceId && Number.isFinite(did) && registry.byDeviceId.has(did)) {
    return registry.byDeviceId.get(did)?.fleetVehicleId ?? null;
  }
  return null;
}

export default resolveVehicleDisplay;
