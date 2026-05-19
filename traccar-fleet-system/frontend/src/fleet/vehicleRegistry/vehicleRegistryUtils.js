import { computeVehicleSetupReadiness } from '../vehicleDetail/setup/vehicleSetupReadiness.js';

/** Display label for linked Traccar device on a fleet vehicle row. */
export function getDeviceLabel(row) {
  if (row.device?.name) return row.device.name;
  if (row.assignment?.deviceId != null) return `ID ${row.assignment.deviceId}`;
  return null;
}

/** Chip props for registry setup column (client-side from list vehicle DTO). */
export function getSetupChipProps(row) {
  const { ready, blockingIncomplete } = computeVehicleSetupReadiness({ vehicle: row });
  if (ready) {
    return { label: 'Setup complete', variant: 'live' };
  }
  if (blockingIncomplete) {
    return { label: 'Setup incomplete', variant: 'offline' };
  }
  return { label: 'In progress', variant: 'outlined' };
}

/** Chip props for registry list (connection only — no telemetry). */
export function getStatusChipProps(row) {
  if (row.device?.status) {
    return row.device.status === 'online'
      ? { label: 'Live', variant: 'live' }
      : { label: 'Offline', variant: 'offline' };
  }
  if (!row.assignment) {
    return { label: 'Unassigned', variant: 'outlined' };
  }
  return null;
}

export function vehicleWorkspacePath(vehicleId) {
  return `/fleet/vehicles/${encodeURIComponent(vehicleId)}`;
}

export function vehicleImmobilizerPath(vehicleId) {
  return `/fleet/vehicles/${encodeURIComponent(vehicleId)}/immobilizer`;
}

export function vehicleSetupPath(vehicleId) {
  return `/fleet/vehicles/${encodeURIComponent(vehicleId)}/setup`;
}
