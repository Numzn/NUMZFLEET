import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Vehicle, DeviceAssignment, VehicleActivityState,
} from '../models/index.js';
import { getTraccarDevicesByIds, getTraccarLatestPositionsByDeviceIds } from '../config/traccar.js';
import { evaluateAndHeal } from '../vehicleEngine/activity/evaluateAndHeal.js';
import { persistActivityState } from '../vehicleEngine/activity/activityStateService.js';
import { recordVehicleStateCorrection } from '../vehicleEngine/activity/vehicleStateAuditService.js';

const isDev = process.env.NODE_ENV === 'development';
const RECONCILE_LOCK_KEY = 84729105; // distinct from telemetryReconciliationScheduler's 84729104

let tickInFlight = false;

function isEnabled() {
  return String(process.env.VEHICLE_STATE_RECONCILE ?? '1') !== '0';
}

function logTick(fields) {
  console.log(JSON.stringify({ event: 'vehicle-state.reconciliation.tick', ...fields, ts: new Date().toISOString() }));
}

async function tryAcquireAdvisoryLock() {
  const rows = await sequelize.query('SELECT pg_try_advisory_lock(:key) AS locked', {
    replacements: { key: RECONCILE_LOCK_KEY },
    type: QueryTypes.SELECT,
  });
  return rows[0]?.locked === true;
}

async function releaseAdvisoryLock() {
  await sequelize.query('SELECT pg_advisory_unlock(:key)', {
    replacements: { key: RECONCILE_LOCK_KEY },
    type: QueryTypes.SELECT,
  });
}

async function withVehicleLock(vehicleId, fn) {
  await sequelize.query('SELECT pg_advisory_lock(hashtext(:key)::bigint)', { replacements: { key: vehicleId } });
  try {
    return await fn();
  } finally {
    await sequelize.query('SELECT pg_advisory_unlock(hashtext(:key)::bigint)', { replacements: { key: vehicleId } });
  }
}

/**
 * Genuinely iterates every vehicle with an active device assignment —
 * unlike telemetryReconciliationScheduler.js (which only re-scans tc_events
 * since a cursor, and structurally can never catch a vehicle that's gone
 * silent with zero new events), this is the mechanism that catches total
 * silence: a crash mid-write, a missed webhook, a historical bug's stale
 * row nobody has revisited since. Cross-company by design (no companyId
 * filter), same pattern as operationAutoCloseScheduler.js.
 *
 * @param {{ source?: 'reconciliation'|'startup' }} [options]
 */
export async function runOnce({ source = 'reconciliation' } = {}) {
  const vehicles = await Vehicle.findAll({ attributes: ['id'] });
  const vehicleIds = vehicles.map((v) => v.id);
  if (!vehicleIds.length) {
    logTick({ scanned: 0, repaired: 0, source });
    return;
  }

  const assignments = await DeviceAssignment.findAll({
    where: { vehicleId: vehicleIds, isActive: true },
  });
  const deviceIdByVehicleId = new Map(assignments.map((a) => [a.vehicleId, Number(a.deviceId)]));
  const deviceIds = [...new Set(assignments.map((a) => Number(a.deviceId)))];

  const [devices, positions] = await Promise.all([
    deviceIds.length ? getTraccarDevicesByIds(deviceIds) : [],
    deviceIds.length ? getTraccarLatestPositionsByDeviceIds(deviceIds) : [],
  ]);
  const deviceMap = new Map(devices.map((d) => [Number(d.id), d]));
  const positionMap = new Map(positions.filter((p) => p.deviceId != null).map((p) => [Number(p.deviceId), p]));

  const existingRows = await VehicleActivityState.findAll({ where: { vehicleId: vehicleIds } });
  const existingByVehicle = new Map(existingRows.map((r) => [String(r.vehicleId), r]));

  let scanned = 0;
  let repaired = 0;
  const now = Date.now();

  for (const vehicleId of vehicleIds) {
    const deviceId = deviceIdByVehicleId.get(vehicleId) ?? null;
    if (deviceId == null) continue; // no active device assignment — nothing to evaluate
    scanned += 1;

    await withVehicleLock(vehicleId, async () => {
      try {
        const device = deviceMap.get(deviceId);
        const position = positionMap.get(deviceId);
        const existing = existingByVehicle.get(String(vehicleId)) ?? null;

        const transition = await evaluateAndHeal({
          vehicleId,
          deviceId,
          deviceStatus: device?.status ?? null,
          deviceLastUpdate: device?.lastupdate ?? null,
          positionSpeed: position?.speed != null ? Number(position.speed) : null,
          existing,
          now,
        }, { source });

        if (transition.changed) {
          await persistActivityState({
            vehicleId,
            deviceId,
            state: transition.state,
            stateEnteredAt: transition.stateEnteredAt,
            stateSource: transition.stateSource,
          }, new Date());
        }

        if (transition.isCorrection) {
          repaired += 1;
          await recordVehicleStateCorrection({
            vehicleId,
            previousState: transition.previousState,
            correctedState: transition.state,
            previousStateEnteredAt: transition.previousStateEnteredAt,
            correctedStateEnteredAt: transition.stateEnteredAt,
            reason: transition.reason,
            source,
            payload: { deviceId, issues: transition.issues },
          });
        }
      } catch (err) {
        console.error('[vehicle-state-reconciliation] vehicle failed', vehicleId, err?.message || err);
      }
    });
  }

  logTick({ scanned, repaired, source });
}

/** One-shot eager pass on server boot — mirrors runImmobilizationStartupReconcile(). */
export async function runVehicleStateStartupReconcile() {
  if (!isEnabled()) return;
  try {
    await runOnce({ source: 'startup' });
  } catch (err) {
    console.warn('[vehicle-state-reconciliation] startup reconcile failed:', err?.message || err);
  }
}

/**
 * Env:
 *   VEHICLE_STATE_RECONCILE — set to '0' to disable entirely (default enabled).
 *   VEHICLE_STATE_RECONCILE_INTERVAL_MS — tick interval (default 900000 / 15m).
 *   VEHICLE_STATE_RECONCILE_STARTUP_DELAY_MS — delay before the first *interval* tick
 *     (default 60000) — separate from runVehicleStateStartupReconcile()'s immediate pass.
 */
export function startVehicleStateReconciliationScheduler() {
  if (!isEnabled()) {
    if (isDev) console.log('[vehicle-state-reconciliation] disabled (VEHICLE_STATE_RECONCILE=0)');
    return () => {};
  }

  const intervalMs = Math.max(60000, Number(process.env.VEHICLE_STATE_RECONCILE_INTERVAL_MS) || 900000);
  const startupDelay = Math.max(0, Number(process.env.VEHICLE_STATE_RECONCILE_STARTUP_DELAY_MS) || 60000);

  const tick = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    let lockAcquired = false;
    try {
      lockAcquired = await tryAcquireAdvisoryLock();
      if (!lockAcquired) return;
      await runOnce({ source: 'reconciliation' });
    } catch (err) {
      console.error('[vehicle-state-reconciliation] poll failed', err?.message || err);
    } finally {
      if (lockAcquired) {
        try {
          await releaseAdvisoryLock();
        } catch (unlockErr) {
          console.error('[vehicle-state-reconciliation] advisory unlock failed:', unlockErr?.message || unlockErr);
        }
      }
      tickInFlight = false;
    }
  };

  const startupTimer = setTimeout(() => { void tick(); }, startupDelay);
  const intervalId = setInterval(() => { void tick(); }, intervalMs);

  if (isDev) console.log(`[vehicle-state-reconciliation] interval ${intervalMs}ms, first interval tick in ${startupDelay}ms`);

  return () => {
    clearTimeout(startupTimer);
    clearInterval(intervalId);
  };
}
