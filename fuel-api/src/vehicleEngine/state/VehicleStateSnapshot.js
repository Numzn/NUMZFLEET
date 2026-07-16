/**
 * Canonical shape returned by VehicleStateEngine.buildVehicleState(). One
 * function, one shape — every field VehicleStateEngine populates is listed
 * here explicitly so the snapshot contract is visible in one place.
 */

/**
 * @param {{
 *   vehicleId: string|null,
 *   deviceId: number|null,
 *   state: 'moving'|'idle'|'offline',
 *   enteredAt: string|null,
 *   durationSeconds: number|null,
 *   confidence: 'observed'|'reconstructed'|'unknown',
 *   health: 'ok'|'warning',
 *   issues: string[],
 *   telemetry: object,
 * }} params
 */
export function buildVehicleStateSnapshot({
  vehicleId,
  deviceId,
  state,
  enteredAt,
  durationSeconds,
  confidence,
  health,
  issues,
  telemetry,
}) {
  return {
    vehicleId: vehicleId ?? null,
    deviceId: deviceId ?? null,
    state,
    enteredAt,
    durationSeconds,
    confidence,
    health,
    issues,
    telemetry,
  };
}
