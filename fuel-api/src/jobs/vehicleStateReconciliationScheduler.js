import sequelize from '../config/database.js';
import {
  Vehicle, DeviceAssignment, VehicleActivityState,
} from '../models/index.js';
import { getTraccarDevicesByIds, getTraccarLatestPositionsByDeviceIds } from '../config/traccar.js';
import { evaluateAndHeal } from '../vehicleEngine/activity/evaluateAndHeal.js';
import { persistActivityState } from '../vehicleEngine/activity/activityStateService.js';
import { recordVehicleStateCorrection } from '../vehicleEngine/activity/vehicleStateAuditService.js';
import {
  notifyVehicleGpsLost,
  notifyVehicleGpsRecovered,
  notifyVehicleExtendedOffline,
  notifyVehicleExcessiveIdle,
} from '../notifications/vehicleStateNotificationService.js';
import { runIntervalJob } from './schedulerRuntime.js';
import { LOCK_KEYS } from './lockKeys.js';

const isDev = process.env.NODE_ENV === 'development';

function isEnabled() {
  return String(process.env.VEHICLE_STATE_RECONCILE ?? '1') !== '0';
}

// Separate from isEnabled(): reconciliation/self-healing must keep running
// even when the newer notification layer is off (default) — this only gates
// the notify calls added below, never the state repair itself.
function alertsEnabled() {
  const raw = String(process.env.VEHICLE_STATE_ALERTS_ENABLED || '0').toLowerCase();
  return raw === '1' || raw === 'true';
}

// Meaningfully longer than the 5-minute "is this vehicle offline right now"
// freshness window in resolveActivityState.js — this is "has it been offline
// long enough that someone should know," a separate, deliberately coarser
// question.
const EXTENDED_OFFLINE_MS = Math.max(600000, Number(process.env.VEHICLE_EXTENDED_OFFLINE_THRESHOLD_MS) || 2 * 60 * 60 * 1000);
// Longer than any normal stop (fuel, delivery, traffic) — round number, not a
// tuned model, same spirit as the maintenance engine's own km thresholds.
const EXCESSIVE_IDLE_MS = Math.max(600000, Number(process.env.VEHICLE_EXCESSIVE_IDLE_THRESHOLD_MS) || 45 * 60 * 1000);

/**
 * Pure decision function, extracted for direct unit testing: given the prior
 * persisted row (or null) and this tick's freshly-evaluated transition,
 * decide which (if any) of the 4 fleet-state alerts should fire. Never does
 * any I/O itself — runOnce() is the only caller, applying the result.
 *
 * @param {{ existing: {state:string}|null, transition: {state:string, changed:boolean, stateEnteredAt:string|Date}, now: number, extendedOfflineMs: number, excessiveIdleMs: number }} args
 */
export function determineVehicleStateAlerts({ existing, transition, now, extendedOfflineMs, excessiveIdleMs }) {
  const previousState = existing?.state ?? null;
  const enteredAtMs = transition?.stateEnteredAt ? new Date(transition.stateEnteredAt).getTime() : null;
  const durationMs = enteredAtMs != null && Number.isFinite(enteredAtMs) ? now - enteredAtMs : null;

  // Transition-instant events (one-shot) — only when the state actually
  // changed this tick, never on a sweep that just confirms "still
  // offline"/"still fine". Also requires a real prior row (existing != null):
  // a vehicle's very first-ever observation is not a transition, just an
  // initial reading, and must not read as "just lost connectivity."
  const gpsLost = existing != null && Boolean(transition?.changed)
    && previousState !== 'offline' && transition?.state === 'offline';
  const gpsRecovered = existing != null && Boolean(transition?.changed)
    && previousState === 'offline' && transition?.state !== 'offline';

  // Sustained-duration thresholds (daily repeat while ongoing) — independent
  // of whether this tick changed anything. Naturally mutually exclusive
  // already: transition.state can only be one value at a time.
  const extendedOffline = transition?.state === 'offline' && durationMs != null && durationMs >= extendedOfflineMs;
  const excessiveIdle = transition?.state === 'idle' && durationMs != null && durationMs >= excessiveIdleMs;

  return {
    gpsLost, gpsRecovered, extendedOffline, excessiveIdle, durationMs,
  };
}

function logTick(fields) {
  console.log(JSON.stringify({ event: 'vehicle-state.reconciliation.tick', ...fields, ts: new Date().toISOString() }));
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
  const vehicles = await Vehicle.findAll({ attributes: ['id', 'companyId', 'name', 'plateNumber'] });
  const vehicleIds = vehicles.map((v) => v.id);
  if (!vehicleIds.length) {
    logTick({ scanned: 0, repaired: 0, source });
    return;
  }
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const alertsOn = alertsEnabled();

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

        if (alertsOn) {
          const vehicle = vehicleById.get(vehicleId);
          const companyId = vehicle?.companyId ?? null;
          const alerts = determineVehicleStateAlerts({
            existing, transition, now, extendedOfflineMs: EXTENDED_OFFLINE_MS, excessiveIdleMs: EXCESSIVE_IDLE_MS,
          });

          if (alerts.gpsLost) {
            await notifyVehicleGpsLost({
              fleetVehicleId: vehicleId, deviceId, stateEnteredAt: transition.stateEnteredAt, vehicle, companyId,
            });
          } else if (alerts.gpsRecovered) {
            await notifyVehicleGpsRecovered({
              fleetVehicleId: vehicleId, deviceId, stateEnteredAt: transition.stateEnteredAt, vehicle, companyId,
            });
          }

          if (alerts.extendedOffline) {
            await notifyVehicleExtendedOffline({
              fleetVehicleId: vehicleId, deviceId, durationMs: alerts.durationMs, vehicle, companyId,
            });
          } else if (alerts.excessiveIdle) {
            await notifyVehicleExcessiveIdle({
              fleetVehicleId: vehicleId, deviceId, durationMs: alerts.durationMs, vehicle, companyId,
            });
          }
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
  const startupDelayMs = Math.max(0, Number(process.env.VEHICLE_STATE_RECONCILE_STARTUP_DELAY_MS) || 60000);

  return runIntervalJob({
    name: 'vehicle-state-reconciliation',
    intervalMs,
    startupDelayMs,
    lockKey: LOCK_KEYS.VEHICLE_STATE_RECONCILIATION,
    task: () => runOnce({ source: 'reconciliation' }),
  });
}
