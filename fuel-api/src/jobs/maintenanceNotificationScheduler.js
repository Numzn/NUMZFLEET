import { Vehicle } from '../models/index.js';
import { loadCompanyMaintenanceDueState } from '../maintenance/maintenanceTraccarAdapter.js';
import { buildRoutineServiceSummaryByVehicle } from '../maintenance/routineServiceSummary.js';
import { isRoutineServiceSchedule } from '../maintenance/routineServiceStatus.js';
import { notifyRoutineServiceState, notifyMaintenanceRisk } from '../notifications/maintenanceNotificationService.js';
import { runIntervalJob } from './schedulerRuntime.js';
import { LOCK_KEYS } from './lockKeys.js';

function isEnabled() {
  const raw = String(process.env.MAINTENANCE_NOTIFICATION_SCHEDULER || '0').toLowerCase();
  return raw === '1' || raw === 'true';
}

const DUE_SOON_BUCKETS = new Set(['dueToday', 'dueThisWeek', 'dueSoon']);

/**
 * Non-routine overdue/due-soon counts for one vehicle — mirrors
 * intelligenceBuilder.js's own overdueCount/dueSoonCount logic, but scoped to
 * this vehicle's own schedule items (already bucket-classified by
 * loadCompanyMaintenanceDueState/classifyDueBucket) rather than a company-wide
 * aggregate, and explicitly excluding the routine-service-tagged schedule
 * (that one is notifyRoutineServiceState's job, not this one's).
 */
export function nonRoutineRiskCounts(vehicleItems) {
  let overdueCount = 0;
  let dueSoonCount = 0;
  for (const item of vehicleItems) {
    if (isRoutineServiceSchedule(item)) continue;
    if (item.bucket === 'overdue') overdueCount += 1;
    else if (DUE_SOON_BUCKETS.has(item.bucket)) dueSoonCount += 1;
  }
  return { overdueCount, dueSoonCount };
}

async function runOnce() {
  const vehicles = await Vehicle.findAll({
    attributes: ['id', 'companyId', 'name', 'plateNumber'],
  });
  const byCompany = new Map();
  for (const vehicle of vehicles) {
    const companyId = String(vehicle.companyId || '');
    if (!companyId) continue;
    if (!byCompany.has(companyId)) byCompany.set(companyId, []);
    byCompany.get(companyId).push(vehicle);
  }

  for (const [companyId, companyVehicles] of byCompany.entries()) {
    const maintenanceState = await loadCompanyMaintenanceDueState(companyId)
      .catch(() => ({ items: [], perVehicle: new Map() }));
    const routineByVehicle = buildRoutineServiceSummaryByVehicle(maintenanceState);
    const perVehicleItems = maintenanceState.perVehicle ?? new Map();

    for (const vehicle of companyVehicles) {
      const fleetVehicleId = String(vehicle.id);
      const vehicleDto = { name: vehicle.name, plateNumber: vehicle.plateNumber };

      try {
        const nextService = routineByVehicle.get(fleetVehicleId);
        // notifyRoutineServiceState() itself no-ops on on_track (mapRoutineStatusToType
        // returns null) and on a missing maintenanceId — no need to pre-filter here.
        if (nextService) {
          await notifyRoutineServiceState({
            fleetVehicleId, nextService, vehicle: vehicleDto, companyId,
          });
        }

        const { overdueCount, dueSoonCount } = nonRoutineRiskCounts(perVehicleItems.get(fleetVehicleId) || []);
        await notifyMaintenanceRisk({
          fleetVehicleId, overdueCount, dueSoonCount, vehicle: vehicleDto, companyId,
        });
      } catch (err) {
        // One vehicle's failure (e.g. a transient publish error) must not
        // skip every other vehicle still left in this company for this tick.
        console.error('[maintenance-notify] vehicle failed', fleetVehicleId, err?.message || err);
      }
    }
  }
}

export function startMaintenanceNotificationScheduler() {
  if (!isEnabled()) {
    return () => {};
  }

  const intervalMs = Math.max(60_000, Number(process.env.MAINTENANCE_NOTIFICATION_POLL_MS) || 10 * 60_000);

  return runIntervalJob({
    name: 'maintenance-notify',
    intervalMs,
    lockKey: LOCK_KEYS.MAINTENANCE_NOTIFICATION,
    task: () => runOnce(),
  });
}
