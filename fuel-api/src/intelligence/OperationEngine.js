/**
 * High-level operation session rules (no DB).
 */

export function parseVehicleIdsInput(vehicleIds) {
  if (vehicleIds == null) {
    return [];
  }
  if (!Array.isArray(vehicleIds)) {
    const error = new Error('vehicleIds must be an array');
    error.statusCode = 400;
    throw error;
  }
  const parsed = [...new Set(vehicleIds.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))];
  if (!parsed.length) {
    const error = new Error('vehicleIds must include at least one valid id');
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

export function assertSessionOpenForMutation(session) {
  if (session.status === 'closed') {
    const error = new Error('Session is closed');
    error.statusCode = 400;
    throw error;
  }
}

export function assertNotBothRecordsAndUpdates(hasRecords, hasUpdates) {
  if (hasRecords && hasUpdates) {
    const error = new Error('Use either records or updates, not both');
    error.statusCode = 400;
    throw error;
  }
}
