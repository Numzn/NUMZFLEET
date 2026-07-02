/**
 * Layer 1 — permanent identity from merged vehicle DTO.
 * @param {object} merged
 * @param {object|null} [odometerState] — from Vehicle Odometer Engine
 */
export function buildRegistry(merged, odometerState = null) {
  if (!merged) return null;
  return {
    id: merged.id,
    name: merged.name,
    plateNumber: merged.plateNumber ?? null,
    make: merged.make ?? null,
    model: merged.model ?? null,
    notes: merged.notes ?? null,
    homeBaseLabel: merged.homeBaseLabel ?? null,
    photoUrl: merged.photoUrl ?? null,
    assignment: merged.assignment ?? null,
    device: merged.device ?? null,
    vehicleSpec: merged.vehicleSpec ?? null,
    fleetConfig: merged.fleetConfig ?? null,
    serviceSummary: merged.serviceSummary ?? null,
    odometerKm: odometerState?.odometerKm ?? null,
    odometerConfidence: odometerState?.odometerConfidence ?? 'unavailable',
    odometerDriftPct: odometerState?.odometerDriftPct ?? null,
    odometerDriftClass: odometerState?.odometerDriftClass ?? 'unknown',
  };
}
