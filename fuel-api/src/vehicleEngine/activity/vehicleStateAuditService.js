import { VehicleStateAuditEvent } from '../../models/index.js';

/**
 * Records a self-healing correction for future investigation. Best-effort:
 * an audit-write failure must never prevent or roll back the actual state
 * repair, so this never throws — a logged warning is the worst case.
 *
 * @param {{
 *   vehicleId: string, previousState: string|null, correctedState: string,
 *   previousStateEnteredAt: Date|null, correctedStateEnteredAt: Date,
 *   reason: string, source: string, payload?: object|null,
 * }} fields
 */
export async function recordVehicleStateCorrection(fields) {
  try {
    await VehicleStateAuditEvent.create({
      vehicleId: fields.vehicleId,
      previousState: fields.previousState ?? null,
      correctedState: fields.correctedState,
      previousStateEnteredAt: fields.previousStateEnteredAt ?? null,
      correctedStateEnteredAt: fields.correctedStateEnteredAt,
      reason: fields.reason,
      source: fields.source,
      payload: fields.payload ?? null,
    });
  } catch (err) {
    console.error('[vehicleStateAudit] failed to record correction:', err?.message || err);
  }
}
