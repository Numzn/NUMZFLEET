import {
  Vehicle, FuelRequest, OperationSession, CompanyDevice, DEFAULT_COMPANY_ID,
} from '../models/index.js';
import traccar from '../config/traccar.js';
import { resolveActivityState } from '../vehicleEngine/activity/resolveActivityState.js';

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

/**
 * Batched device fetch + canonical resolver evaluation — not a parallel raw-
 * SQL rule. One query (not one per device), and "online" now agrees exactly
 * with telemetryHub/the persisted activity state for the same devices.
 */
async function queryDeviceStats(companyId) {
  try {
    const pool = traccar.getTraccarPool();
    const deviceIds = await getCompanyDeviceIds(companyId);

    const scopeClause = deviceIds.length > 0
      ? `WHERE id IN (${deviceIds.map(() => '?').join(',')})`
      : '';
    const [rows] = await pool.execute(
      `SELECT status, lastupdate FROM tc_devices ${scopeClause}`,
      deviceIds.length > 0 ? deviceIds : [],
    );

    const online = rows.filter((row) => resolveActivityState({
      deviceStatus: row.status,
      deviceLastUpdate: row.lastupdate,
      positionSpeed: null,
    }) !== 'offline').length;

    return { total: rows.length, online };
  } catch {
    return { total: 0, online: 0 };
  }
}

export default { getFleetCommandCenterKpis };
