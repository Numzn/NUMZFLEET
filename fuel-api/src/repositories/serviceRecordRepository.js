import { ServiceRecord } from '../models/index.js';

export async function listByCompany(companyId, { fleetVehicleId, status } = {}) {
  const where = { companyId: String(companyId) };
  if (fleetVehicleId != null) where.fleetVehicleId = String(fleetVehicleId);
  if (status) where.status = String(status);
  return ServiceRecord.findAll({ where, order: [['createdAt', 'DESC']] });
}

export async function findByIdForCompany(id, companyId) {
  return ServiceRecord.findOne({
    where: { id: Number(id), companyId: String(companyId) },
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

export function summarizeServiceRecordRows(rows = []) {
  let openCount = 0;
  let inProgressCount = 0;
  let lastCompletedAt = null;

  for (const row of rows) {
    const status = row.status;
    if (status === 'open') openCount += 1;
    if (status === 'in_progress') inProgressCount += 1;
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
