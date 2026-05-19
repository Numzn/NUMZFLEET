/** Display label for linked Traccar device on a fleet vehicle row. */
export function getDeviceLabel(row) {
  if (row.device?.name) return row.device.name;
  if (row.assignment?.deviceId != null) return `ID ${row.assignment.deviceId}`;
  return null;
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
