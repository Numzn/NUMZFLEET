import {
  VehicleCompliance,
  VehicleDocument,
} from '../models/index.js';
import {
  assertVehicleInTenant,
} from './vehicleFleetService.js';
import {
  VEHICLE_COMPLIANCE_STATUSES,
  VEHICLE_COMPLIANCE_TYPES,
} from '../models/VehicleCompliance.js';
import { evaluateDueDateStatus } from '../compliance/complianceEvaluator.js';

const DEFAULT_LEAD_DAYS = 30;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function asIsoDate(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw badRequest('dueDate must be a valid date');
  }
  return d.toISOString().slice(0, 10);
}

function parseType(type) {
  const parsed = String(type || '').trim().toUpperCase();
  if (!VEHICLE_COMPLIANCE_TYPES.includes(parsed)) {
    throw badRequest(`type must be one of: ${VEHICLE_COMPLIANCE_TYPES.join(', ')}`);
  }
  return parsed;
}

function parseStatus(status) {
  const parsed = String(status || '').trim().toUpperCase();
  if (!VEHICLE_COMPLIANCE_STATUSES.includes(parsed)) {
    throw badRequest(`status must be one of: ${VEHICLE_COMPLIANCE_STATUSES.join(', ')}`);
  }
  return parsed;
}

function parseLeadDays(value) {
  if (value == null || value === '') return DEFAULT_LEAD_DAYS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3650) {
    throw badRequest('reminderLeadDays must be an integer between 0 and 3650');
  }
  return parsed;
}

function parseMetadata(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('metadata must be a JSON object');
  }
  return value;
}

async function assertDocumentBelongsToVehicle(companyId, fleetVehicleId, documentId) {
  if (documentId == null) return null;
  const row = await VehicleDocument.findOne({
    where: {
      id: Number(documentId),
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
    },
  });
  if (!row) {
    const error = new Error('Linked document not found for this vehicle');
    error.statusCode = 404;
    throw error;
  }
  return row;
}

export function toDto(row) {
  if (!row) return null;
  const plain = row.toJSON ? row.toJSON() : row;
  const reminderLeadDays = Number(plain.reminderLeadDays ?? DEFAULT_LEAD_DAYS);
  // Computed on read from the same evaluator the notification scheduler
  // uses (evaluateDueDateStatus) — the stored `status` column is legacy/
  // non-authoritative and must not be echoed back as current truth.
  const evaluated = evaluateDueDateStatus({ dueDate: plain.dueDate, reminderLeadDays });
  return {
    id: plain.id,
    companyId: plain.companyId,
    fleetVehicleId: plain.fleetVehicleId,
    type: plain.type,
    dueDate: plain.dueDate || null,
    status: evaluated.status.toUpperCase(),
    daysRemaining: evaluated.daysRemaining,
    reminderLeadDays,
    documentId: plain.documentId ?? null,
    metadata: plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {},
    createdAt: plain.createdAt ? new Date(plain.createdAt).toISOString() : null,
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
  };
}

export async function listComplianceForVehicle(companyId, fleetVehicleId) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  const rows = await VehicleCompliance.findAll({
    where: {
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
    },
    order: [['dueDate', 'ASC'], ['createdAt', 'DESC']],
  });
  return rows.map(toDto);
}

export async function listComplianceForCompany(companyId) {
  const rows = await VehicleCompliance.findAll({
    where: {
      companyId: String(companyId),
    },
    order: [['fleetVehicleId', 'ASC'], ['dueDate', 'ASC']],
  });
  return rows.map(toDto);
}

/**
 * Routine Service is Traccar-owned (tc_maintenances, tagged numzServicePackage)
 * — a compliance row of this type would be a second, parallel source of truth
 * for the same obligation. Historical rows (if any) are left alone; only new
 * creation/conversion through the public API is blocked.
 */
export function rejectRoutineServiceType(type) {
  if (type === 'ROUTINE_SERVICE') {
    const error = new Error(
      'Routine Service is owned by the Traccar maintenance schedule — configure it from Vehicle Setup, not as a compliance obligation.',
    );
    error.statusCode = 409;
    throw error;
  }
}

export async function createComplianceForVehicle(companyId, fleetVehicleId, payload = {}) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  const type = parseType(payload.type);
  rejectRoutineServiceType(type);
  const status = parseStatus(payload.status || 'VALID');
  const dueDate = asIsoDate(payload.dueDate);
  const reminderLeadDays = parseLeadDays(payload.reminderLeadDays);
  const documentId = payload.documentId != null ? Number(payload.documentId) : null;
  await assertDocumentBelongsToVehicle(companyId, fleetVehicleId, documentId);

  const row = await VehicleCompliance.create({
    companyId: String(companyId),
    fleetVehicleId: String(fleetVehicleId),
    type,
    dueDate,
    status,
    reminderLeadDays,
    documentId,
    metadata: parseMetadata(payload.metadata),
  });
  return toDto(row);
}

export async function updateComplianceForVehicle(
  companyId,
  fleetVehicleId,
  complianceId,
  payload = {},
) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  const row = await VehicleCompliance.findOne({
    where: {
      id: Number(complianceId),
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
    },
  });
  if (!row) {
    const error = new Error('Compliance item not found');
    error.statusCode = 404;
    throw error;
  }

  const patch = {};
  if (payload.type !== undefined) {
    const nextType = parseType(payload.type);
    // Allow editing a pre-existing ROUTINE_SERVICE row (historical data is
    // preserved as-is); block converting some OTHER type into it, or
    // creating a new parallel one via update-in-place.
    if (nextType !== row.type) {
      rejectRoutineServiceType(nextType);
    }
    patch.type = nextType;
  }
  if (payload.status !== undefined) patch.status = parseStatus(payload.status);
  if (payload.dueDate !== undefined) patch.dueDate = asIsoDate(payload.dueDate);
  if (payload.reminderLeadDays !== undefined) patch.reminderLeadDays = parseLeadDays(payload.reminderLeadDays);
  if (payload.metadata !== undefined) patch.metadata = parseMetadata(payload.metadata);
  if (payload.documentId !== undefined) {
    const documentId = payload.documentId != null ? Number(payload.documentId) : null;
    await assertDocumentBelongsToVehicle(companyId, fleetVehicleId, documentId);
    patch.documentId = documentId;
  }
  if (!Object.keys(patch).length) {
    throw badRequest('No valid fields to update');
  }

  await row.update(patch);
  return toDto(row);
}

export async function deleteComplianceForVehicle(companyId, fleetVehicleId, complianceId) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  const row = await VehicleCompliance.findOne({
    where: {
      id: Number(complianceId),
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
    },
  });
  if (!row) {
    const error = new Error('Compliance item not found');
    error.statusCode = 404;
    throw error;
  }
  await row.destroy();
  return { ok: true };
}
