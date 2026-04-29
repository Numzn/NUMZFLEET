import traccar from '../config/traccar.js';
import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';

const CACHE_TTL_MS = 2 * 60 * 1000; // 2-minute cache — public endpoint, no auth

let cache = { data: null, at: 0 };

/**
 * Returns aggregated, non-sensitive fleet stats for the public login page.
 * Queries:
 *   - Traccar MySQL: total devices + devices seen in last 5 min (online)
 *   - PostgreSQL: pending fuel requests
 * Caches for 2 minutes to avoid hammering DBs on every page load.
 */
export async function getFleetSummary() {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const [deviceStats, pendingCount] = await Promise.all([
    queryDeviceStats(),
    queryPendingFuelRequests(),
  ]);

  const data = {
    totalVehicles: deviceStats.total,
    onlineVehicles: deviceStats.online,
    pendingFuelRequests: pendingCount,
    updatedAt: new Date().toISOString(),
  };

  cache = { data, at: now };
  return data;
}

async function queryDeviceStats() {
  try {
    const pool = traccar.getTraccarPool();
    const [rows] = await pool.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN lastupdate >= NOW() - INTERVAL 5 MINUTE THEN 1 ELSE 0 END) AS online
       FROM tc_devices`,
    );
    const row = rows[0] || {};
    return {
      total: Number(row.total || 0),
      online: Number(row.online || 0),
    };
  } catch {
    return { total: 0, online: 0 };
  }
}

async function queryPendingFuelRequests() {
  try {
    const [row] = await sequelize.query(
      `SELECT COUNT(*) AS cnt FROM fuel_requests WHERE status = 'pending'`,
      { type: QueryTypes.SELECT },
    );
    return Number(row?.cnt || 0);
  } catch (error) {
    console.warn('[fleetSummary] Failed to query pending fuel requests:', error?.message || error);
    return 0;
  }
}
