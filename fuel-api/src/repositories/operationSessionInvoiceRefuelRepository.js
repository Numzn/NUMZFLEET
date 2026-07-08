import { OperationSessionInvoiceRefuel } from '../models/index.js';

export async function setForInvoice(invoiceId, refuelIds, options = {}) {
  await OperationSessionInvoiceRefuel.destroy({ where: { invoiceId: Number(invoiceId) }, ...options });
  const uniqueIds = [...new Set(refuelIds.map(Number))];
  if (!uniqueIds.length) return [];
  return OperationSessionInvoiceRefuel.bulkCreate(
    uniqueIds.map((refuelId) => ({ invoiceId: Number(invoiceId), refuelId })),
    options,
  );
}

export async function listByInvoiceIds(invoiceIds, options = {}) {
  if (!invoiceIds.length) return [];
  return OperationSessionInvoiceRefuel.findAll({
    where: { invoiceId: invoiceIds.map(Number) },
    ...options,
  });
}
