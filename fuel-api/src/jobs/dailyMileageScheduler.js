import { DeviceAssignment, VehicleOdometerAnchor } from '../models/index.js';
import sequelize from '../config/database.js';
import { computeDailyMileage } from '../vehicleEngine/mileage/dailyMileageService.js';
import { establishPendingBaseline } from '../vehicleEngine/odometer/vehicleOdometerAnchorService.js';
import { retryPendingMaintenanceRelinks } from '../services/trackerAssignmentService.js';
import { ingestAllTrackers } from '../vehicleEngine/readings/acceptedReadingsService.js';
import { addLocalDays, localDateString, localMidnightUtc, DEFAULT_BUSINESS_TIMEZONE } from '../utils/businessDay.js';
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

const HOUR_MS = 60 * 60 * 1000;

/**
 * A finished day is re-computed once shortly after it ends (the 5-minute sweep
 * last touched it just before midnight, so its stored distance stops minutes —
 * or hours, if the vehicle was moving — short of the real day) and once more a
 * day later, to pick up positions a tracker buffered offline and uploaded late.
 * Both fall inside the 48 h grace window after which a resolved row is frozen.
 */
export const SETTLE_AFTER_DAY_END_MS = [3 * HOUR_MS, 27 * HOUR_MS];

/**
 * The finished days that may still need a final recompute right now, each with
 * the instant a row must have been computed after to count as settled. Pure.
 * @returns {{ localDate: string, dayStart: Date, settledBefore: Date }[]}
 */
export function pastDaysToSettle(now, timeZone = DEFAULT_BUSINESS_TIMEZONE) {
  const today = localDateString(now, timeZone);
  const days = [];
  [1, 2].forEach((back) => {
    const localDate = addLocalDays(today, -back);
    const dayStart = localMidnightUtc(localDate, timeZone);
    const dayEnd = dayStart.getTime() + 24 * HOUR_MS;
    const reached = SETTLE_AFTER_DAY_END_MS.map((after) => dayEnd + after).filter((at) => at <= now.getTime());
    if (reached.length) days.push({ localDate, dayStart, settledBefore: new Date(Math.max(...reached)) });
  });
  return days;
}

/**
 * Existing ledger rows of finished days that were last computed before their
 * latest settle point. Only vehicles whose current device was already assigned
 * when the day began are returned: a recompute reads the CURRENT assignment's
 * history, so a vehicle whose tracker was swapped mid-way would have a good
 * historical row overwritten with another device's numbers (or with nothing).
 */
export async function listUnsettledPastRows(now) {
  const rows = [];
  for (const { localDate, dayStart, settledBefore } of pastDaysToSettle(now)) {
    const [found] = await sequelize.query(
      `SELECT m."vehicleId"
         FROM vehicle_daily_mileage m
         JOIN device_assignments a
           ON a."vehicleId" = m."vehicleId" AND a."isActive" = true AND a."assignedAt" <= :dayStart
        WHERE m."localDate" = :localDate
          -- a day built from accepted readings belongs to the ingest and is never recomputed here
          AND m.evidence <> 'accepted'
          AND (m."latestCapturedAt" IS NULL OR m."latestCapturedAt" < :settledBefore)`,
      { replacements: { localDate, dayStart, settledBefore } },
    );
    found.forEach((row) => rows.push({ vehicleId: row.vehicleId, localDate }));
  }
  return rows;
}

async function listVehiclesWithPendingBaseline() {
  const rows = await VehicleOdometerAnchor.findAll({
    where: { supersededAt: null, telemetryKm: null },
    attributes: ['vehicleId'],
  });
  return rows.map((r) => r.vehicleId);
}

/**
 * Work that keeps the vehicle-owned mileage consistent:
 *   1. a replacement tracker's baseline is completed with its first valid counter reading (the accepted
 *      mileage is held until then; see establishPendingBaseline) -- BEFORE the ingest, so the baseline and
 *      the remembered counter are taken from the same reading;
 *   2. every assigned tracker's new positions are run through the acceptance rules and written to the
 *      remembered state, the decision log and the daily ledger (see acceptedReadingsService);
 *   3. maintenance-schedule re-links that failed after a tracker change are retried.
 * Each part is isolated: one failing vehicle or an unreachable Traccar never stops the rest.
 */
export async function runMileageHousekeeping({
  listPendingBaselines = listVehiclesWithPendingBaseline,
  establish = establishPendingBaseline,
  ingest = ingestAllTrackers,
  retryRelinks = retryPendingMaintenanceRelinks,
} = {}) {
  const summary = {
    baselinesEstablished: 0,
    baselineFailures: 0,
    ingest: { trackers: 0, bootstrapped: 0, ingested: 0, positions: 0, failed: 0 },
    relinks: { attempted: 0, synced: 0, failed: 0 },
  };

  const vehicleIds = [...new Set(await listPendingBaselines())];
  for (const vehicleId of vehicleIds) {
    try {
      if (await establish({ vehicleId })) summary.baselinesEstablished += 1;
    } catch (err) {
      summary.baselineFailures += 1;
      console.error('[dailyMileage] establishing baseline failed', { vehicleId, error: err?.message || err });
    }
  }

  try {
    summary.ingest = await ingest();
  } catch (err) {
    summary.ingestError = err?.message || String(err);
    console.error('[dailyMileage] ingesting tracker readings failed', { error: summary.ingestError });
  }

  try {
    summary.relinks = await retryRelinks();
  } catch (err) {
    summary.relinkError = err?.message || String(err);
    console.error('[dailyMileage] retrying maintenance re-links failed', { error: summary.relinkError });
  }
  return summary;
}

/**
 * One sweep of the daily-mileage ledger: computeDailyMileage for every
 * vehicle with an active device assignment, then a final recompute of any
 * finished day that has not been settled yet (see SETTLE_AFTER_DAY_END_MS).
 * Cross-company by design (no companyId filter — reads are tenant-scoped, the
 * ledger itself is per vehicle), same pattern as
 * vehicleStateReconciliationScheduler.runOnce.
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
  listUnsettled = listUnsettledPastRows,
  compute = computeDailyMileage,
  housekeeping = runMileageHousekeeping,
  now = () => new Date(),
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

  let settled = 0;
  let settleFailed = 0;
  let pastRows = [];
  try {
    pastRows = await listUnsettled(now());
  } catch (err) {
    // Finalising history must never take down the live sweep that already ran.
    settleFailed += 1;
    console.error('[dailyMileage] listing unsettled days failed', { error: err?.message || err });
  }

  for (const { vehicleId, localDate } of pastRows) {
    try {
      await compute({ vehicleId, localDate });
      settled += 1;
    } catch (err) {
      settleFailed += 1;
      console.error('[dailyMileage] settle failed', { vehicleId, localDate, error: err?.message || err });
    }
  }

  let housekeepingSummary;
  try {
    housekeepingSummary = await housekeeping();
  } catch (err) {
    // Housekeeping must never take down the live sweep that already ran.
    housekeepingSummary = { failed: true, error: err?.message || String(err) };
    console.error('[dailyMileage] housekeeping failed', { error: housekeepingSummary.error });
  }

  return { scanned: vehicleIds.length, computed, failed, settled, settleFailed, housekeeping: housekeepingSummary };
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
