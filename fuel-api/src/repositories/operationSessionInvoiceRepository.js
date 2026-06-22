import { OperationSessionInvoice } from '../models/index.js';

export async function findByOperationId(operationId, options = {}) {
  return OperationSessionInvoice.findOne({
    where: { operationId: Number(operationId) },
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    ...options,
  });
}

export async function listByOperationId(operationId, options = {}) {
  return OperationSessionInvoice.findAll({
    where: { operationId: Number(operationId) },
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    ...options,
  });
}

export async function findById(invoiceId, options = {}) {
  return OperationSessionInvoice.findByPk(Number(invoiceId), options);
}

export async function createForOperation(operationId, values, options = {}) {
  return OperationSessionInvoice.create(
    { operationId: Number(operationId), ...values },
    options,
  );
}

export async function upsertForOperation(operationId, values, options = {}) {
  const existing = await findByOperationId(operationId, options);
  if (existing) {
    await existing.update(values, options);
    return existing;
  }
  return createForOperation(operationId, values, options);
}
