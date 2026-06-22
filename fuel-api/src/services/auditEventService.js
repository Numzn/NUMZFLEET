import { OperationAuditEvent } from '../models/index.js';

export const AUDIT_EVENT_TYPES = Object.freeze({
  FORECAST_GENERATED: 'ForecastGenerated',
  FORECAST_APPROVED: 'ForecastApproved',
  VEHICLE_ADDED: 'VehicleAdded',
  VEHICLE_REMOVED: 'VehicleRemoved',
  VEHICLE_SKIPPED: 'VehicleSkipped',
  VEHICLE_UNSKIPPED: 'VehicleUnskipped',
  FUEL_RECORDED: 'FuelRecorded',
  MILEAGE_OVERRIDDEN: 'MileageOverridden',
  OPERATION_UNLOCKED: 'OperationUnlocked',
  ADJUSTMENT_CREATED: 'AdjustmentCreated',
  OPERATION_LOCKED: 'OperationLocked',
  OPERATION_CLOSED: 'OperationClosed',
  INVOICE_RECONCILED: 'InvoiceReconciled',
});

export async function recordAuditEvent(operationId, eventType, userId, payload = null, options = {}) {
  const id = Number(operationId);
  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error(`Invalid operationId for audit event: ${operationId}`);
    error.statusCode = 500;
    throw error;
  }

  const createOptions = options.transaction ? { transaction: options.transaction } : {};

  return OperationAuditEvent.create({
    operationId: id,
    eventType,
    userId: userId != null ? Number(userId) : null,
    payload,
  }, createOptions);
}
