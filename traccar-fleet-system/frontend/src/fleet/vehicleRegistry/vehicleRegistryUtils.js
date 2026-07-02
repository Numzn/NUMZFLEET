import { computeVehicleSetupReadiness } from '../vehicleDetail/setup/vehicleSetupReadiness.js';
import { resolveVehicleDisplayFromFleetRow } from '../display/resolveVehicleDisplay.js';

/** Primary + secondary lines for registry vehicle column. */
export function getVehicleRegistryLines(row) {
  const display = resolveVehicleDisplayFromFleetRow(row);
  return { primary: display.primary, secondary: display.secondary };
}

/** Single-line vehicle label (e.g. exports, dialogs). */
export function getVehicleLabel(row) {
  const { primary, secondary } = getVehicleRegistryLines(row);
  if (secondary) {
    return `${primary} (${secondary})`;
  }
  return primary;
}

/** Tracker assignment label — connection state lives in the Status column. */
export function getTrackerLinkLabel(row) {
  if (!row?.assignment?.deviceId) return 'Not assigned';
  return 'Linked';
}

/** @deprecated use getTrackerLinkLabel */
export function getDeviceLabel(row) {
  return getTrackerLinkLabel(row);
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

/** Routine Service status chip for vehicle registry list. */
export function getRoutineServiceChipProps(row) {
  const rs = row?.routineService;
  if (!rs?.status || rs.status === 'on_track') return null;
  const colorMap = {
    upcoming: 'info',
    due_soon: 'warning',
    prepare: 'warning',
    due_now: 'error',
    overdue: 'error',
  };
  return {
    label: rs.statusLabel || rs.status,
    variant: colorMap[rs.status] || 'outlined',
  };
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
