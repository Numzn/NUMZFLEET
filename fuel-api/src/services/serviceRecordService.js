import { SERVICE_RECORD_STATUSES } from '../models/ServiceRecord.js';
import { DeviceAssignment } from '../models/index.js';
import {
  listByCompany,
  findByIdForCompany,
  findByIdForVehicle,
  createRecord,
} from '../repositories/serviceRecordRepository.js';
import { assertVehicleInTenant } from './vehicleFleetService.js';
import { setVerifiedOdometer } from './odometerService.js';

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

export function toServiceRecordDto(record) {
  if (!record) return null;
  const plain = record.toJSON ? record.toJSON() : record;
  return {
    id: plain.id,
    companyId: plain.companyId,
    fleetVehicleId: plain.fleetVehicleId,
    deviceId: plain.deviceId != null ? Number(plain.deviceId) : null,
    maintenanceId: plain.maintenanceId != null ? Number(plain.maintenanceId) : null,
    title: plain.title,
    status: plain.status,
    odometerKm: plain.odometerKm != null ? Number(plain.odometerKm) : null,
    cost: plain.cost != null ? Number(plain.cost) : null,
    vendor: plain.vendor || null,
    notes: plain.notes || null,
    dueAt: plain.dueAt ? new Date(plain.dueAt).toISOString() : null,
    completedAt: plain.completedAt ? new Date(plain.completedAt).toISOString() : null,
    createdBy: plain.createdBy != null ? Number(plain.createdBy) : null,
    createdAt: plain.createdAt ? new Date(plain.createdAt).toISOString() : null,
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
  };
}

async function resolveActiveDeviceId(fleetVehicleId) {
  const assignment = await DeviceAssignment.findOne({
    where: { vehicleId: String(fleetVehicleId), isActive: true },
  });
  return assignment ? Number(assignment.deviceId) : null;
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

  const record = await createRecord({
    companyId: String(companyId),
    fleetVehicleId: String(fleetVehicleId),
    deviceId: Number.isFinite(deviceId) && deviceId > 0 ? deviceId : null,
    maintenanceId: payload.maintenanceId != null ? Number(payload.maintenanceId) : null,
    title,
    status: 'open',
    odometerKm: parseOptionalNumber(payload.odometerKm, 'odometerKm'),
    cost: parseOptionalNumber(payload.cost, 'cost'),
    vendor: payload.vendor ? String(payload.vendor).trim() : null,
    notes: payload.notes ? String(payload.notes) : null,
    dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
    createdBy: user?.id ?? null,
  });

  return toServiceRecordDto(record);
}

export async function updateServiceRecord(companyId, fleetVehicleId, id, payload = {}) {
  await assertVehicleInTenant(fleetVehicleId, companyId);

  const record = await findByIdForVehicle(id, companyId, fleetVehicleId);
  if (!record) {
    throw notFound('Service record not found');
  }

  const patch = {};
  if (payload.status != null) {
    const status = String(payload.status);
    if (!SERVICE_RECORD_STATUSES.includes(status)) {
      throw badRequest(`status must be one of: ${SERVICE_RECORD_STATUSES.join(', ')}`);
    }
    patch.status = status;
    patch.completedAt = status === 'completed' ? new Date() : null;
  }
  if (payload.title != null) {
    const title = String(payload.title).trim();
    if (!title) throw badRequest('title cannot be empty');
    patch.title = title;
  }
  if ('cost' in payload) patch.cost = parseOptionalNumber(payload.cost, 'cost');
  if ('odometerKm' in payload) patch.odometerKm = parseOptionalNumber(payload.odometerKm, 'odometerKm');
  if ('vendor' in payload) patch.vendor = payload.vendor ? String(payload.vendor).trim() : null;
  if ('notes' in payload) patch.notes = payload.notes ? String(payload.notes) : null;
  if ('dueAt' in payload) patch.dueAt = payload.dueAt ? new Date(payload.dueAt) : null;

  await record.update(patch);

  const deviceId = record.deviceId != null
    ? Number(record.deviceId)
    : await resolveActiveDeviceId(fleetVehicleId);

  if (patch.status === 'completed' && record.odometerKm != null && deviceId) {
    try {
      await setVerifiedOdometer(deviceId, record.odometerKm, 'service', record.createdBy);
    } catch (error) {
      console.error('Failed to set verified odometer from service record:', error.message);
    }
  }

  return toServiceRecordDto(record);
}

/** Back-compat global list/create without nested vehicle route. */
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
