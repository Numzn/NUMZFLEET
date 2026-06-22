/**
 * Canonical vehicle display labels (mirrors frontend resolveVehicleDisplay).
 */

function trimOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

/**
 * @param {object} input
 * @returns {{ primary: string, secondary: string|null, deviceId: number|null, fleetVehicleId: string|null }}
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

  const primary = nickname || registration || deviceName || 'Vehicle';

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
  };
}

/**
 * @param {import('../models/Vehicle.js').default|object|null} vehicle
 * @param {object|null} [device]
 */
export function resolveVehicleDisplayFromModels(vehicle, device = null) {
  if (!vehicle) {
    return resolveVehicleDisplay({
      deviceName: device?.name,
      deviceId: device?.id,
    });
  }
  return resolveVehicleDisplay({
    name: vehicle.name ?? vehicle.get?.('name'),
    plateNumber: vehicle.plateNumber ?? vehicle.get?.('plateNumber'),
    deviceName: device?.name,
    deviceId: device?.id,
    fleetVehicleId: vehicle.id ?? vehicle.get?.('id'),
  });
}

/**
 * Single-line label for notifications and reports.
 */
export function formatVehicleDisplayLine(display) {
  if (!display) return 'Vehicle';
  if (display.secondary) {
    return `${display.primary} (${display.secondary})`;
  }
  return display.primary;
}

export default resolveVehicleDisplay;
