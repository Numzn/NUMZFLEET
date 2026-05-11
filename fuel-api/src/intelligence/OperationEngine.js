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

/**
 * Parsed vehicle plan lines for POST /operation-sessions (required for new sessions).
 * @returns {{ vehicleId: number, plannedLitres: number }[]}
 */
export function parseSessionVehiclesInput(vehicles) {
  if (vehicles == null) {
    const error = new Error('vehicles is required: [{ vehicleId, plannedLitres }, ...]');
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(vehicles)) {
    const error = new Error('vehicles must be an array');
    error.statusCode = 400;
    throw error;
  }
  if (vehicles.length === 0) {
    const error = new Error('vehicles must include at least one entry');
    error.statusCode = 400;
    throw error;
  }
  const seen = new Set();
  const out = [];
  for (const v of vehicles) {
    const vehicleId = Number(v?.vehicleId);
    if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
      const error = new Error('Each vehicle must have a positive vehicleId');
      error.statusCode = 400;
      throw error;
    }
    const plannedLitres = Number(v?.plannedLitres);
    if (!Number.isFinite(plannedLitres) || plannedLitres <= 0) {
      const error = new Error('Each vehicle must have plannedLitres greater than 0');
      error.statusCode = 400;
      throw error;
    }
    if (seen.has(vehicleId)) {
      const error = new Error(`Duplicate vehicleId ${vehicleId} in vehicles`);
      error.statusCode = 400;
      throw error;
    }
    seen.add(vehicleId);
    out.push({ vehicleId, plannedLitres });
  }
  return out;
}
