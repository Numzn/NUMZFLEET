import {
  Vehicle, FuelRequest, OperationSession, CompanyDevice, DEFAULT_COMPANY_ID,
} from '../models/index.js';
import traccar from '../config/traccar.js';

export async function getFleetCommandCenterKpis(companyId = DEFAULT_COMPANY_ID) {
  const [registeredVehicles, pendingFuel, activeOperations, deviceStats] = await Promise.all([
    Vehicle.count({ where: { companyId } }),
    // Awaiting-review requests only (matches the canonical 'pending' status the UI surfaces).
    FuelRequest.count({ where: { companyId, status: 'pending' } }),
    // "Active" = approved operations currently recordable (draft is still being planned).
    OperationSession.count({ where: { companyId, status: 'approved' } }),
    queryDeviceStats(companyId),
  ]);

  return {
    registeredVehicles,
    pendingFuelRequests: pendingFuel,
    activeOperations,
    trackersOnline: deviceStats.online,
    trackersTotal: deviceStats.total,
    updatedAt: new Date().toISOString(),
  };
}

async function getCompanyDeviceIds(companyId) {
  try {
    const rows = await CompanyDevice.findAll({
      where: { companyId, isActive: true },
      attributes: ['traccarDeviceId'],
    });
    return rows
      .map((r) => Number(r.traccarDeviceId))
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

async function queryDeviceStats(companyId) {
  try {
    const pool = traccar.getTraccarPool();
    const deviceIds = await getCompanyDeviceIds(companyId);

    // Scope to the company's mapped trackers when provisioned; otherwise fall
    // back to a global count so unprovisioned tenants still see live numbers.
    if (deviceIds.length > 0) {
      const placeholders = deviceIds.map(() => '?').join(',');
      const [rows] = await pool.execute(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN lastupdate >= NOW() - INTERVAL 5 MINUTE THEN 1 ELSE 0 END) AS online
         FROM tc_devices WHERE id IN (${placeholders})`,
        deviceIds,
      );
      const row = rows[0] || {};
      return { total: Number(row.total || 0), online: Number(row.online || 0) };
    }

    const [rows] = await pool.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN lastupdate >= NOW() - INTERVAL 5 MINUTE THEN 1 ELSE 0 END) AS online
       FROM tc_devices`,
    );
    const row = rows[0] || {};
    return { total: Number(row.total || 0), online: Number(row.online || 0) };
  } catch {
    return { total: 0, online: 0 };
  }
}

export default { getFleetCommandCenterKpis };
