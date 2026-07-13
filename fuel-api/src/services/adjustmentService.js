import { OperationAdjustment } from '../models/index.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from '../services/auditEventService.js';

export async function createAdjustment({
  operationId,
  refuelId,
  field,
  originalValue,
  newValue,
  reason,
  userId,
}, options = {}) {
  const createOptions = options.transaction ? { transaction: options.transaction } : {};

  const row = await OperationAdjustment.create({
    operationId: Number(operationId),
    refuelId: refuelId != null ? Number(refuelId) : null,
    field: String(field),
    originalValue: originalValue != null ? String(originalValue) : null,
    newValue: String(newValue),
    reason: reason || null,
    userId: Number(userId),
  }, createOptions);

  await recordAuditEvent(operationId, AUDIT_EVENT_TYPES.ADJUSTMENT_CREATED, userId, {
    adjustmentId: row.id,
    refuelId,
    field,
    originalValue,
    newValue,
    reason,
  }, options);

  return row;
}

export async function listByOperationId(operationId) {
  return OperationAdjustment.findAll({
    where: { operationId: Number(operationId) },
    order: [['createdAt', 'DESC']],
  });
}
