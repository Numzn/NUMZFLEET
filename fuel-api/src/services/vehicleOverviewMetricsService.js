import { Op } from 'sequelize';
import { ServiceRecord } from '../models/index.js';
import { resolveCostAmount } from '../maintenance/maintenanceCostService.js';

function sumCosts(rows) {
  return rows.reduce((s, r) => s + resolveCostAmount(r), 0);
}

export async function aggregateMaintenanceCosts(companyId, fleetVehicleId) {
  const where = {
    companyId: String(companyId),
    fleetVehicleId: String(fleetVehicleId),
    status: 'completed',
  };

  const rows = await ServiceRecord.findAll({
    where,
    attributes: ['cost', 'actualCost', 'completedAt', 'createdAt'],
    order: [['completedAt', 'ASC']],
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const mtdRows = rows.filter((r) => r.completedAt && new Date(r.completedAt) >= monthStart);
  const ytdRows = rows.filter((r) => r.completedAt && new Date(r.completedAt) >= yearStart);

  const earliest = rows.find((r) => r.completedAt)?.completedAt
    || rows[0]?.createdAt
    || null;

  return {
    maintenanceCostMtd: sumCosts(mtdRows),
    maintenanceCostYtd: sumCosts(ytdRows),
    maintenanceCostLifetime: sumCosts(rows),
    maintenanceLifetimeSince: earliest ? new Date(earliest).toISOString() : null,
  };
}

export async function findNextServiceDue(companyId, fleetVehicleId) {
  const row = await ServiceRecord.findOne({
    where: {
      companyId: String(companyId),
      fleetVehicleId: String(fleetVehicleId),
      status: { [Op.in]: ['open', 'in_progress'] },
      dueAt: { [Op.ne]: null },
    },
    order: [['dueAt', 'ASC']],
  });

  if (!row) return null;

  return {
    title: row.title,
    dueDate: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    remainingKm: row.odometerKm != null ? Number(row.odometerKm) : null,
  };
}
