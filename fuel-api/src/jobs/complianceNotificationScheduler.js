import { Vehicle } from '../models/index.js';
import { loadCompanyMaintenanceDueState } from '../maintenance/maintenanceTraccarAdapter.js';
import { buildRoutineServiceSummaryByVehicle } from '../maintenance/routineServiceSummary.js';
import { listComplianceForCompany } from '../services/vehicleComplianceService.js';
import { evaluateCompliance } from '../compliance/complianceEvaluator.js';
import { notifyComplianceFinding } from '../notifications/complianceNotificationService.js';
import { runIntervalJob } from './schedulerRuntime.js';
import { LOCK_KEYS } from './lockKeys.js';

function isEnabled() {
  const raw = String(process.env.COMPLIANCE_NOTIFICATION_SCHEDULER || '0').toLowerCase();
  return raw === '1' || raw === 'true';
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
    const maintenanceState = await loadCompanyMaintenanceDueState(companyId).catch(() => ({ items: [] }));
    const routineByVehicle = buildRoutineServiceSummaryByVehicle(maintenanceState);
    const complianceRows = await listComplianceForCompany(companyId);
    const complianceByVehicle = new Map();
    for (const row of complianceRows) {
      const key = String(row.fleetVehicleId);
      const list = complianceByVehicle.get(key) || [];
      list.push(row);
      complianceByVehicle.set(key, list);
    }

    for (const vehicle of companyVehicles) {
      const fleetVehicleId = String(vehicle.id);
      try {
        const findings = evaluateCompliance({
          fleetVehicleId,
          companyId,
          routineNextService: routineByVehicle.get(fleetVehicleId) || null,
          complianceItems: complianceByVehicle.get(fleetVehicleId) || [],
        });
        for (const finding of findings) {
          // evaluateCompliance() bundles a ROUTINE_SERVICE finding (from
          // routineNextService) into the same array as its date-based
          // compliance items — needed here only because vehicleEngineService.js
          // shares this same evaluateCompliance() call for the dashboard, so
          // its signature can't drop routineNextService. Notifying on it here
          // too would double-notify against maintenanceNotificationScheduler.js,
          // which now owns routine-service notifications on its own interval.
          if (finding.type === 'ROUTINE_SERVICE') continue;
          // eslint-disable-next-line no-await-in-loop -- a handful of findings per vehicle; not worth Promise.all's complexity here.
          await notifyComplianceFinding({
            finding,
            vehicle: { name: vehicle.name, plateNumber: vehicle.plateNumber },
            companyId,
          });
        }
      } catch (err) {
        // One vehicle's failure must not skip every other vehicle still left
        // in this company for this tick — same reasoning as
        // maintenanceNotificationScheduler.js's identical guard.
        console.error('[compliance-notify] vehicle failed', fleetVehicleId, err?.message || err);
      }
    }
  }
}

export function startComplianceNotificationScheduler() {
  if (!isEnabled()) {
    return () => {};
  }

  const intervalMs = Math.max(60_000, Number(process.env.COMPLIANCE_NOTIFICATION_POLL_MS) || 10 * 60_000);

  return runIntervalJob({
    name: 'compliance-notify',
    intervalMs,
    lockKey: LOCK_KEYS.COMPLIANCE_NOTIFICATION,
    task: () => runOnce(),
  });
}
