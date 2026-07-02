import {
  findById as findSessionById,
} from '../repositories/operationSessionRepository.js';
import {
  findByOperationId,
  listByOperationId,
  findById as findInvoiceById,
  createForOperation,
  upsertForOperation,
} from '../repositories/operationSessionInvoiceRepository.js';
import { recordAuditEvent, AUDIT_EVENT_TYPES } from './auditEventService.js';
import { emitDomainEvent } from '../events/eventBus.js';
import { EVENT_NAMES } from '../events/eventNames.js';
import { assertCanAccessSession } from './operationSessionCore.js';
import { maybePersistLock } from './operationLockHelper.js';

// Matched when within 1 litre or 0.5% of the recorded dispensed total.
const ABSOLUTE_MATCH_LITRES = 1;
const RELATIVE_MATCH_FRACTION = 0.005;

function toNullableNumber(value, field) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${field} must be a non-negative number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

export function reconcileInvoice({ invoiceTotalLitres, sessionActualLitres }) {
  const invoiceL = Number(invoiceTotalLitres);
  const sessionL = Number(sessionActualLitres);
  const varianceLitres = Number((invoiceL - sessionL).toFixed(3));
  const absVariance = Math.abs(varianceLitres);
  const tolerance = Math.max(ABSOLUTE_MATCH_LITRES, sessionL * RELATIVE_MATCH_FRACTION);
  const status = absVariance <= tolerance ? 'matched' : 'variance';
  return { varianceLitres, status };
}

function hasExtractedLitres(record) {
  if (record.totalLitres != null && Number(record.totalLitres) > 0) return true;
  return record.dieselLitres != null || record.petrolLitres != null;
}

function normalizeAttachmentUrl(value) {
  if (value == null || value === '') return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/api/operation-sessions/attachments/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      const error = new Error('attachmentUrl must be an http or https link');
      error.statusCode = 400;
      throw error;
    }
    return trimmed;
  } catch (e) {
    if (e.statusCode) throw e;
    const error = new Error('attachmentUrl must be a valid URL or uploaded file path');
    error.statusCode = 400;
    throw error;
  }
}
function invoiceLitres(record) {
  if (!hasExtractedLitres(record)) return 0;
  if (record.totalLitres != null) return Number(record.totalLitres);
  return Number(record.dieselLitres || 0) + Number(record.petrolLitres || 0);
}

/**
 * Day-level rollup across every Smart Invoice on a Fuel Day. The sum of all
 * invoice litres is reconciled against the dispensed total; a day with no
 * invoices is pending. Attachment-only rows stay pending until litres are extracted.
 */
export function summarizeInvoices(invoiceRecords = [], { sessionActualLitres = 0, sessionActualCost = 0 } = {}) {
  const count = invoiceRecords.length;
  const pendingExtraction = invoiceRecords.filter((r) => !hasExtractedLitres(r)).length;
  const totalInvoiceLitres = Number(
    invoiceRecords.reduce((acc, r) => {
      const t = invoiceLitres(r);
      return acc + (Number.isFinite(t) ? t : 0);
    }, 0).toFixed(3),
  );
  const totalInvoiceCost = Number(
    invoiceRecords.reduce((acc, r) => acc + (r.totalCost != null ? Number(r.totalCost) : 0), 0).toFixed(2),
  );

  if (count === 0) {
    return {
      count: 0,
      pendingExtraction: 0,
      totalInvoiceLitres: 0,
      totalInvoiceCost: 0,
      varianceLitres: null,
      varianceCost: null,
      status: 'pending',
    };
  }

  if (pendingExtraction > 0) {
    return {
      count,
      pendingExtraction,
      totalInvoiceLitres,
      totalInvoiceCost,
      varianceLitres: null,
      varianceCost: null,
      status: 'pending',
    };
  }

  const { varianceLitres, status } = reconcileInvoice({
    invoiceTotalLitres: totalInvoiceLitres,
    sessionActualLitres,
  });
  const varianceCost = totalInvoiceCost > 0
    ? Number((totalInvoiceCost - Number(sessionActualCost || 0)).toFixed(2))
    : null;

  return {
    count,
    pendingExtraction: 0,
    totalInvoiceLitres,
    totalInvoiceCost,
    varianceLitres,
    varianceCost,
    status,
  };
}

export function toInvoiceDto(record) {
  if (!record) return null;
  return {
    id: record.id,
    operationId: record.operationId,
    invoiceNumber: record.invoiceNumber || null,
    invoiceDate: record.invoiceDate || null,
    dieselLitres: record.dieselLitres != null ? Number(record.dieselLitres) : null,
    petrolLitres: record.petrolLitres != null ? Number(record.petrolLitres) : null,
    totalLitres: record.totalLitres != null ? Number(record.totalLitres) : null,
    totalCost: record.totalCost != null ? Number(record.totalCost) : null,
    reconciliationStatus: record.reconciliationStatus || 'pending',
    varianceLitres: record.varianceLitres != null ? Number(record.varianceLitres) : null,
    varianceCost: record.varianceCost != null ? Number(record.varianceCost) : null,
    enteredBy: record.enteredBy != null ? Number(record.enteredBy) : null,
    attachmentUrl: record.attachmentUrl || null,
    extractionPending: !hasExtractedLitres(record),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** Build the persisted invoice fields from a payload, reconciled against the day. */
function buildInvoiceValues(payload, session, { requireAttachment = false } = {}) {
  const attachmentUrl = normalizeAttachmentUrl(payload.attachmentUrl);
  const dieselLitres = toNullableNumber(payload.dieselLitres, 'dieselLitres');
  const petrolLitres = toNullableNumber(payload.petrolLitres, 'petrolLitres');
  let totalLitres = toNullableNumber(payload.totalLitres, 'totalLitres');
  if (totalLitres == null && (dieselLitres != null || petrolLitres != null)) {
    totalLitres = Number(((dieselLitres || 0) + (petrolLitres || 0)).toFixed(3));
  }

  if (requireAttachment && !attachmentUrl) {
    const error = new Error('attachmentUrl is required');
    error.statusCode = 400;
    throw error;
  }

  if (totalLitres == null) {
    if (!attachmentUrl) {
      const error = new Error('attachmentUrl or totalLitres is required');
      error.statusCode = 400;
      throw error;
    }
    return {
      invoiceNumber: payload.invoiceNumber ? String(payload.invoiceNumber).trim() : null,
      invoiceDate: payload.invoiceDate || null,
      attachmentUrl,
      dieselLitres: null,
      petrolLitres: null,
      totalLitres: null,
      totalCost: null,
      reconciliationStatus: 'pending',
      varianceLitres: null,
      varianceCost: null,
    };
  }

  const totalCost = toNullableNumber(payload.totalCost, 'totalCost');
  const sessionActualLitres = Number(session.totalActualFuel || 0);
  const sessionActualCost = Number(session.totalActualCost || 0);
  const { varianceLitres, status } = reconcileInvoice({
    invoiceTotalLitres: totalLitres,
    sessionActualLitres,
  });
  const varianceCost = totalCost != null
    ? Number((totalCost - sessionActualCost).toFixed(2))
    : null;

  return {
    invoiceNumber: payload.invoiceNumber ? String(payload.invoiceNumber).trim() : null,
    invoiceDate: payload.invoiceDate || null,
    attachmentUrl,
    dieselLitres,
    petrolLitres,
    totalLitres,
    totalCost,
    reconciliationStatus: status,
    varianceLitres,
    varianceCost,
  };
}

function assertInvoiceWritable(session) {
  if (!['approved', 'locked'].includes(session.status)) {
    const error = new Error('Invoice can only be reconciled on approved or locked operations');
    error.statusCode = 400;
    throw error;
  }
}

/** Lightweight fetch used when assembling the session details DTO. */
export async function getInvoiceDtoForSession(sessionId) {
  const record = await findByOperationId(sessionId);
  return toInvoiceDto(record);
}

/** All Smart Invoices + day rollup, used when assembling the session details DTO. */
export async function getInvoicesForSessionDetails(session) {
  const records = await listByOperationId(session.id);
  const invoices = records.map(toInvoiceDto);
  const invoiceSummary = summarizeInvoices(records, {
    sessionActualLitres: Number(session.totalActualFuel || 0),
    sessionActualCost: Number(session.totalActualCost || 0),
  });
  return { invoices, invoiceSummary, invoice: invoices[0] || null };
}

export async function listOperationInvoices(user, sessionId, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  const { invoices, invoiceSummary } = await getInvoicesForSessionDetails(session);
  return { invoices, invoiceSummary };
}

export async function createOperationInvoice(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  assertInvoiceWritable(session);

  const values = buildInvoiceValues(payload, session, { requireAttachment: true });
  const record = await createForOperation(session.id, {
    companyId: session.companyId ?? null,
    ...values,
    enteredBy: user.id,
  });

  await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.INVOICE_RECONCILED, user.id, {
    invoiceId: record.id,
    invoiceNumber: record.invoiceNumber,
    attachmentUrl: values.attachmentUrl,
    totalLitres: values.totalLitres,
    sessionActualLitres: Number(session.totalActualFuel || 0),
    varianceLitres: values.varianceLitres,
    reconciliationStatus: values.reconciliationStatus,
  });

  const dto = toInvoiceDto(record);
  emitDomainEvent(EVENT_NAMES.OPERATION_INVOICE_RECONCILED, {
    session,
    user,
    sessionId: session.id,
    invoiceId: record.id,
    invoice: dto,
  });

  return dto;
}

export async function updateOperationInvoice(user, sessionId, invoiceId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  assertInvoiceWritable(session);

  const record = await findInvoiceById(invoiceId);
  if (!record || Number(record.operationId) !== Number(session.id)) {
    const error = new Error('Invoice not found on this Fueling Day');
    error.statusCode = 404;
    throw error;
  }

  const values = buildInvoiceValues({
    invoiceNumber: payload.invoiceNumber !== undefined ? payload.invoiceNumber : record.invoiceNumber,
    invoiceDate: payload.invoiceDate !== undefined ? payload.invoiceDate : record.invoiceDate,
    attachmentUrl: payload.attachmentUrl !== undefined ? payload.attachmentUrl : record.attachmentUrl,
    dieselLitres: payload.dieselLitres !== undefined ? payload.dieselLitres : record.dieselLitres,
    petrolLitres: payload.petrolLitres !== undefined ? payload.petrolLitres : record.petrolLitres,
    totalLitres: payload.totalLitres !== undefined ? payload.totalLitres : record.totalLitres,
    totalCost: payload.totalCost !== undefined ? payload.totalCost : record.totalCost,
  }, session);
  await record.update({ ...values, enteredBy: user.id });

  await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.INVOICE_RECONCILED, user.id, {
    invoiceId: record.id,
    invoiceNumber: record.invoiceNumber,
    attachmentUrl: values.attachmentUrl,
    totalLitres: values.totalLitres,
    sessionActualLitres: Number(session.totalActualFuel || 0),
    varianceLitres: values.varianceLitres,
    reconciliationStatus: values.reconciliationStatus,
  });

  const dto = toInvoiceDto(record);
  emitDomainEvent(EVENT_NAMES.OPERATION_INVOICE_RECONCILED, {
    session,
    user,
    sessionId: session.id,
    invoiceId: record.id,
    invoice: dto,
  });

  return dto;
}

export async function getOperationInvoice(user, sessionId, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  return toInvoiceDto(await findByOperationId(session.id));
}

/** Back-compat single-invoice upsert kept for the legacy PUT /:id/invoice route. */
export async function upsertOperationInvoice(user, sessionId, payload = {}, companyId = null) {
  const session = await findSessionById(sessionId);
  assertCanAccessSession(session, user, companyId);
  await maybePersistLock(session);
  assertInvoiceWritable(session);

  const values = buildInvoiceValues(payload, session);
  const record = await upsertForOperation(session.id, {
    companyId: session.companyId ?? null,
    ...values,
    enteredBy: user.id,
  });

  await recordAuditEvent(session.id, AUDIT_EVENT_TYPES.INVOICE_RECONCILED, user.id, {
    invoiceNumber: record.invoiceNumber,
    totalLitres: values.totalLitres,
    sessionActualLitres: Number(session.totalActualFuel || 0),
    varianceLitres: values.varianceLitres,
    reconciliationStatus: values.reconciliationStatus,
  });

  const dto = toInvoiceDto(record);
  emitDomainEvent(EVENT_NAMES.OPERATION_INVOICE_RECONCILED, {
    session,
    user,
    sessionId: session.id,
    invoiceId: record.id,
    invoice: dto,
  });

  return dto;
}
