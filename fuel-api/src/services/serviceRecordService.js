import {
  SERVICE_RECORD_STATUSES,
  SERVICE_RECORD_PRIORITIES,
} from '../models/ServiceRecord.js';
import { DeviceAssignment, Vehicle } from '../models/index.js';
import {
  listByCompany,
  findByIdForCompany,
  findByIdForVehicle,
  createRecord,
  nextWorkOrderNumber,
} from '../repositories/serviceRecordRepository.js';
import { assertVehicleInTenant } from './vehicleFleetService.js';
import { applyObservation } from '../vehicleEngine/odometer/applyObservation.js';
import { notifyRoutineServiceCompleted } from '../notifications/maintenanceNotificationService.js';
import { resetMaintenanceScheduleAfterCompletion } from '../maintenance/routineServiceTraccarService.js';

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function parseOptionalNumber(value, field) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw badRequest(`${field} must be a non-negative number`);
  }
  return number;
}

/** UI-facing status: legacy open → scheduled */
export function normalizeStatusForDto(status) {
  if (status === 'open') return 'scheduled';
  return status;
}

export function toServiceRecordDto(record) {
  if (!record) return null;
  const plain = record.toJSON ? record.toJSON() : record;
  const actualCost = plain.actualCost != null
    ? Number(plain.actualCost)
    : (plain.cost != null ? Number(plain.cost) : null);

  return {
    id: plain.id,
    companyId: plain.companyId,
    fleetVehicleId: plain.fleetVehicleId,
    deviceId: plain.deviceId != null ? Number(plain.deviceId) : null,
    maintenanceId: plain.maintenanceId != null ? Number(plain.maintenanceId) : null,
    workOrderNumber: plain.workOrderNumber || null,
    title: plain.title,
    status: normalizeStatusForDto(plain.status),
    priority: plain.priority || 'medium',
    workshop: plain.workshop || plain.vendor || null,
    assignee: plain.assignee || null,
    odometerKm: plain.odometerKm != null ? Number(plain.odometerKm) : null,
    cost: actualCost,
    actualCost,
    estimatedCost: plain.estimatedCost != null ? Number(plain.estimatedCost) : null,
    labourCost: plain.labourCost != null ? Number(plain.labourCost) : null,
    partsCost: plain.partsCost != null ? Number(plain.partsCost) : null,
    otherCost: plain.otherCost != null ? Number(plain.otherCost) : null,
    vendor: plain.vendor || null,
    notes: plain.notes || null,
    dueAt: plain.dueAt ? new Date(plain.dueAt).toISOString() : null,
    scheduledDueDate: plain.scheduledDueDate
      ? new Date(plain.scheduledDueDate).toISOString()
      : (plain.dueAt ? new Date(plain.dueAt).toISOString() : null),
    completedAt: plain.completedAt ? new Date(plain.completedAt).toISOString() : null,
    scheduleResetStatus: plain.scheduleResetStatus || 'not_applicable',
    scheduleResetError: plain.scheduleResetError || null,
    createdBy: plain.createdBy != null ? Number(plain.createdBy) : null,
    createdAt: plain.createdAt ? new Date(plain.createdAt).toISOString() : null,
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
    vehicle: plain.vehicle
      ? {
        id: plain.vehicle.id,
        name: plain.vehicle.name,
        plateNumber: plain.vehicle.plateNumber,
      }
      : null,
  };
}

async function resolveActiveDeviceId(fleetVehicleId) {
  const assignment = await DeviceAssignment.findOne({
    where: { vehicleId: String(fleetVehicleId), isActive: true },
  });
  return assignment ? Number(assignment.deviceId) : null;
}

function normalizeStatusForDb(status) {
  const s = String(status);
  if (s === 'scheduled') return 'open';
  return s;
}

export async function listServiceRecords(companyId, filters = {}) {
  const rows = await listByCompany(companyId, filters);
  return rows.map(toServiceRecordDto);
}

export async function listServiceRecordsForVehicle(companyId, fleetVehicleId) {
  await assertVehicleInTenant(fleetVehicleId, companyId);
  return listServiceRecords(companyId, { fleetVehicleId });
}

export async function createServiceRecord(user, companyId, fleetVehicleId, payload = {}) {
  await assertVehicleInTenant(fleetVehicleId, companyId);

  const title = String(payload.title || '').trim();
  if (!title) {
    throw badRequest('title is required');
  }

  const deviceId = payload.deviceId != null
    ? Number(payload.deviceId)
    : await resolveActiveDeviceId(fleetVehicleId);

  const resolvedDeviceId = Number.isFinite(deviceId) && deviceId > 0 ? deviceId : null;

  const priority = payload.priority ? String(payload.priority) : 'medium';
  if (!SERVICE_RECORD_PRIORITIES.includes(priority)) {
    throw badRequest(`priority must be one of: ${SERVICE_RECORD_PRIORITIES.join(', ')}`);
  }

  const workOrderNumber = await nextWorkOrderNumber(companyId);
  const estimatedCost = parseOptionalNumber(payload.estimatedCost, 'estimatedCost');
  const actualCost = parseOptionalNumber(payload.actualCost ?? payload.cost, 'actualCost');

  const record = await createRecord({
    companyId: String(companyId),
    fleetVehicleId: String(fleetVehicleId),
    deviceId: resolvedDeviceId,
    deprecatedVehicleId: resolvedDeviceId,
    maintenanceId: payload.maintenanceId != null ? Number(payload.maintenanceId) : null,
    workOrderNumber,
    title,
    status: payload.status ? normalizeStatusForDb(payload.status) : 'open',
    priority,
    workshop: payload.workshop ? String(payload.workshop).trim() : null,
    assignee: payload.assignee ? String(payload.assignee).trim() : null,
    odometerKm: parseOptionalNumber(payload.odometerKm, 'odometerKm'),
    cost: actualCost,
    actualCost,
    estimatedCost,
    labourCost: parseOptionalNumber(payload.labourCost, 'labourCost'),
    partsCost: parseOptionalNumber(payload.partsCost, 'partsCost'),
    otherCost: parseOptionalNumber(payload.otherCost, 'otherCost'),
    vendor: payload.vendor ? String(payload.vendor).trim() : (payload.workshop ? String(payload.workshop).trim() : null),
    notes: payload.notes ? String(payload.notes) : null,
    dueAt: payload.dueAt || payload.scheduledDueDate ? new Date(payload.dueAt || payload.scheduledDueDate) : null,
    scheduledDueDate: payload.scheduledDueDate || payload.dueAt
      ? new Date(payload.scheduledDueDate || payload.dueAt)
      : null,
    createdBy: user?.id ?? null,
  });

  return toServiceRecordDto(record);
}

export async function updateServiceRecord(companyId, fleetVehicleId, id, payload = {}, options = {}) {
  await assertVehicleInTenant(fleetVehicleId, companyId);

  const record = await findByIdForVehicle(id, companyId, fleetVehicleId);
  if (!record) {
    throw notFound('Service record not found');
  }

  const wasCompleted = record.status === 'completed';

  const patch = {};
  if (payload.status != null) {
    const status = normalizeStatusForDb(payload.status);
    if (!SERVICE_RECORD_STATUSES.includes(status)) {
      throw badRequest(`status must be one of: ${SERVICE_RECORD_STATUSES.join(', ')}`);
    }
    patch.status = status;
    if (payload.completedAt) {
      patch.completedAt = new Date(payload.completedAt);
    } else {
      patch.completedAt = status === 'completed' ? new Date() : null;
    }
  } else if (payload.completedAt) {
    patch.completedAt = new Date(payload.completedAt);
  }
  if (payload.title != null) {
    const title = String(payload.title).trim();
    if (!title) throw badRequest('title cannot be empty');
    patch.title = title;
  }
  if (payload.priority != null) {
    const priority = String(payload.priority);
    if (!SERVICE_RECORD_PRIORITIES.includes(priority)) {
      throw badRequest(`priority must be one of: ${SERVICE_RECORD_PRIORITIES.join(', ')}`);
    }
    patch.priority = priority;
  }
  if ('workshop' in payload) patch.workshop = payload.workshop ? String(payload.workshop).trim() : null;
  if ('assignee' in payload) patch.assignee = payload.assignee ? String(payload.assignee).trim() : null;
  if ('cost' in payload || 'actualCost' in payload) {
    const actualCost = parseOptionalNumber(payload.actualCost ?? payload.cost, 'actualCost');
    patch.actualCost = actualCost;
    patch.cost = actualCost;
  }
  if ('estimatedCost' in payload) patch.estimatedCost = parseOptionalNumber(payload.estimatedCost, 'estimatedCost');
  if ('labourCost' in payload) patch.labourCost = parseOptionalNumber(payload.labourCost, 'labourCost');
  if ('partsCost' in payload) patch.partsCost = parseOptionalNumber(payload.partsCost, 'partsCost');
  if ('otherCost' in payload) patch.otherCost = parseOptionalNumber(payload.otherCost, 'otherCost');
  if ('odometerKm' in payload) patch.odometerKm = parseOptionalNumber(payload.odometerKm, 'odometerKm');
  if ('vendor' in payload) patch.vendor = payload.vendor ? String(payload.vendor).trim() : null;
  if ('notes' in payload) patch.notes = payload.notes ? String(payload.notes) : null;
  if ('dueAt' in payload) patch.dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
  if ('scheduledDueDate' in payload) {
    patch.scheduledDueDate = payload.scheduledDueDate ? new Date(payload.scheduledDueDate) : null;
    if (payload.scheduledDueDate) patch.dueAt = new Date(payload.scheduledDueDate);
  }

  await record.update(patch);

  const deviceId = record.deviceId != null
    ? Number(record.deviceId)
    : await resolveActiveDeviceId(fleetVehicleId);

  if (patch.status === 'completed' && record.odometerKm != null && deviceId) {
    try {
      await applyObservation(deviceId, record.odometerKm, 'service');
    } catch (error) {
      console.error('Failed to set verified odometer from service record:', error.message);
    }
  }

  // Schedule rebase runs server-side, in the same request as completion —
  // not a second client-initiated call — so a lost connection between steps
  // can no longer leave the system silently inconsistent. Outcome is
  // persisted (scheduleResetStatus/scheduleResetError), not just thrown.
  if (patch.status === 'completed' && !wasCompleted && record.maintenanceId != null && deviceId) {
    try {
      await resetMaintenanceScheduleAfterCompletion({
        deviceId,
        maintenanceId: record.maintenanceId,
        completionOdometerKm: record.odometerKm,
      });
      await record.update({ scheduleResetStatus: 'synced', scheduleResetError: null });
    } catch (error) {
      await record.update({
        scheduleResetStatus: 'failed',
        scheduleResetError: error?.message || 'Unknown error',
      });
    }
  }

  const dto = toServiceRecordDto(record);

  if (patch.status === 'completed' && !wasCompleted && record.maintenanceId != null) {
    try {
      const vehicle = await Vehicle.findByPk(String(fleetVehicleId), {
        attributes: ['id', 'name', 'plateNumber'],
      });
      await notifyRoutineServiceCompleted({
        record: dto,
        vehicle,
        companyId: String(companyId),
        actorUserId: options.actorUserId ?? record.createdBy ?? null,
      });
    } catch (error) {
      console.error(
        'Failed to publish routine service completion notification:',
        error?.message || error,
        error?.stack || '',
      );
    }
  }

  return dto;
}

/**
 * Retry a failed Traccar schedule rebase. Idempotent: only acts on records
 * currently marked `failed`, and always resets to the SAME completion
 * mileage already on the record — never a newly-entered value — so a retry
 * can never shift the baseline further or create a duplicate schedule.
 */
export async function retryScheduleReset(companyId, fleetVehicleId, id) {
  await assertVehicleInTenant(fleetVehicleId, companyId);

  const record = await findByIdForVehicle(id, companyId, fleetVehicleId);
  if (!record) {
    throw notFound('Service record not found');
  }
  if (record.status !== 'completed' || record.maintenanceId == null) {
    throw badRequest('Only a completed record linked to a maintenance schedule can be retried');
  }
  if (record.scheduleResetStatus !== 'failed') {
    // Nothing to retry — already synced, or never applicable. Not an error;
    // just a no-op, so a stray double-click can't do anything unexpected.
    return toServiceRecordDto(record);
  }

  const deviceId = record.deviceId != null
    ? Number(record.deviceId)
    : await resolveActiveDeviceId(fleetVehicleId);

  try {
    await resetMaintenanceScheduleAfterCompletion({
      deviceId,
      maintenanceId: record.maintenanceId,
      completionOdometerKm: record.odometerKm,
    });
    await record.update({ scheduleResetStatus: 'synced', scheduleResetError: null });
  } catch (error) {
    await record.update({
      scheduleResetStatus: 'failed',
      scheduleResetError: error?.message || 'Unknown error',
    });
  }

  return toServiceRecordDto(record);
}

export async function createServiceRecordLegacy(user, companyId, payload = {}) {
  const fleetVehicleId = payload.fleetVehicleId || payload.fleet_vehicle_id;
  if (!fleetVehicleId) {
    throw badRequest('fleetVehicleId is required');
  }
  return createServiceRecord(user, companyId, fleetVehicleId, payload);
}

export async function updateServiceRecordLegacy(companyId, id, payload = {}) {
  const record = await findByIdForCompany(id, companyId);
  if (!record) {
    throw notFound('Service record not found');
  }
  return updateServiceRecord(companyId, record.fleetVehicleId, id, payload);
}
