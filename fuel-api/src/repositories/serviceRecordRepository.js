import { Op } from 'sequelize';
import { ServiceRecord, Vehicle } from '../models/index.js';
import { SERVICE_RECORD_ACTIVE_STATUSES } from '../models/ServiceRecord.js';

export async function listByCompany(companyId, { fleetVehicleId, status, activeOnly } = {}) {
  const where = { companyId: String(companyId) };
  if (fleetVehicleId != null) where.fleetVehicleId = String(fleetVehicleId);
  if (status) where.status = String(status);
  if (activeOnly) {
    where.status = { [Op.in]: SERVICE_RECORD_ACTIVE_STATUSES };
  }

  return ServiceRecord.findAll({
    where,
    include: [{
      model: Vehicle,
      as: 'vehicle',
      attributes: ['id', 'name', 'plateNumber'],
      required: false,
    }],
    order: [['updatedAt', 'DESC']],
  });
}

export async function findByIdForCompany(id, companyId) {
  return ServiceRecord.findOne({
    where: { id: Number(id), companyId: String(companyId) },
    include: [{
      model: Vehicle,
      as: 'vehicle',
      attributes: ['id', 'name', 'plateNumber'],
      required: false,
    }],
  });
}

export async function findByIdForVehicle(id, companyId, fleetVehicleId) {
  return ServiceRecord.findOne({
    where: {
      id: Number(id),
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
    },
  });
}

export async function createRecord(values) {
  return ServiceRecord.create(values);
}

export async function nextWorkOrderNumber(companyId) {
  const maxId = await ServiceRecord.max('id', { where: { companyId: String(companyId) } });
  const seq = Number(maxId || 0) + 1;
  return `WO-${String(24000 + seq).padStart(5, '0')}`;
}

export function summarizeServiceRecordRows(rows = []) {
  let openCount = 0;
  let inProgressCount = 0;
  let awaitingPartsCount = 0;
  let lastCompletedAt = null;

  for (const row of rows) {
    const status = row.status;
    if (status === 'open' || status === 'scheduled') openCount += 1;
    if (status === 'in_progress') inProgressCount += 1;
    if (status === 'awaiting_parts') awaitingPartsCount += 1;
    if (status === 'completed' && row.completedAt) {
      const ts = new Date(row.completedAt).getTime();
      if (!lastCompletedAt || ts > new Date(lastCompletedAt).getTime()) {
        lastCompletedAt = row.completedAt;
      }
    }
  }

  return {
    openCount,
    inProgressCount,
    awaitingPartsCount,
    lastCompletedAt: lastCompletedAt
      ? new Date(lastCompletedAt).toISOString()
      : null,
  };
}

export async function summarizeForVehicle(fleetVehicleId, companyId) {
  const rows = await ServiceRecord.findAll({
    where: {
      fleetVehicleId: String(fleetVehicleId),
      companyId: String(companyId),
    },
    attributes: ['status', 'completedAt'],
  });

  return summarizeServiceRecordRows(rows);
}

export async function findLatestCompletedForMaintenance(companyId, fleetVehicleId, maintenanceId) {
  if (maintenanceId == null) return null;
  return ServiceRecord.findOne({
    where: {
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
      maintenanceId: Number(maintenanceId),
      status: 'completed',
    },
    order: [['completedAt', 'DESC']],
  });
}

export async function countCompletedToday(companyId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return ServiceRecord.count({
    where: {
      companyId: String(companyId),
      status: 'completed',
      completedAt: { [Op.gte]: start },
    },
  });
}
