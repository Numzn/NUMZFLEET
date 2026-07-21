import { DeviceAssignment } from '../models/index.js';
import { computeDailyMileage } from '../vehicleEngine/mileage/dailyMileageService.js';
import { runIntervalJob } from './schedulerRuntime.js';
import { LOCK_KEYS } from './lockKeys.js';

const isDev = process.env.NODE_ENV === 'development';

function logTick(fields) {
  console.log(JSON.stringify({ event: 'daily-mileage.tick', ...fields, ts: new Date().toISOString() }));
}

async function listActivelyAssignedVehicleIds() {
  const assignments = await DeviceAssignment.findAll({
    where: { isActive: true },
    attributes: ['vehicleId'],
  });
  return assignments.map((a) => a.vehicleId);
}

/**
 * One sweep of the daily-mileage ledger: computeDailyMileage for every
 * vehicle with an active device assignment. Cross-company by design (no
 * companyId filter — reads are tenant-scoped, the ledger itself is per
 * vehicle), same pattern as vehicleStateReconciliationScheduler.runOnce.
 *
 * computeDailyMileage reconstructs the day-start baseline from Traccar
 * position history and upserts idempotently on (vehicleId, localDate), so
 * sweep timing, restarts, and duplicate runs never corrupt the ledger.
 * Per-vehicle failures are isolated so one bad device cannot starve the rest.
 *
 * Dependencies are injectable for tests only; production callers use defaults.
 */
export async function runDailyMileageSweep({
  listVehicleIds = listActivelyAssignedVehicleIds,
  compute = computeDailyMileage,
} = {}) {
  const vehicleIds = [...new Set(await listVehicleIds())];
  let computed = 0;
  let failed = 0;

  for (const vehicleId of vehicleIds) {
    try {
      await compute({ vehicleId });
      computed += 1;
    } catch (err) {
      failed += 1;
      console.error('[dailyMileage] compute failed', { vehicleId, error: err?.message || err });
    }
  }

  return { scanned: vehicleIds.length, computed, failed };
}

/**
 * Keeps the vehicle_daily_mileage ledger current so the fleet list can serve
 * "distance travelled today" without per-request Traccar history scans.
 *
 * Env:
 *   DAILY_MILEAGE_INTERVAL_MS — tick interval (default 300000 / 5 min). Set 0 to disable.
 *   DAILY_MILEAGE_STARTUP_DELAY_MS — delay before first tick (default 20000).
 */
export function startDailyMileageScheduler() {
  const raw = process.env.DAILY_MILEAGE_INTERVAL_MS;
  const intervalMs = raw === undefined || raw === '' ? 300000 : parseInt(raw, 10);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    if (isDev) console.log('[dailyMileage] disabled (DAILY_MILEAGE_INTERVAL_MS is 0 or invalid)');
    return () => {};
  }

  const startupDelayMs = Math.max(0, parseInt(process.env.DAILY_MILEAGE_STARTUP_DELAY_MS ?? '20000', 10) || 0);

  return runIntervalJob({
    name: 'dailyMileage',
    intervalMs,
    startupDelayMs,
    lockKey: LOCK_KEYS.DAILY_MILEAGE,
    task: async () => {
      const stats = await runDailyMileageSweep();
      logTick(stats);
    },
  });
}
