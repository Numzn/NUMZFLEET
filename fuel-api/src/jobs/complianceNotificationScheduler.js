import { Vehicle } from '../models/index.js';
import { loadCompanyMaintenanceDueState } from '../maintenance/maintenanceTraccarAdapter.js';
import { buildRoutineServiceSummaryByVehicle } from '../maintenance/routineServiceSummary.js';
import { listComplianceForCompany } from '../services/vehicleComplianceService.js';
import { evaluateCompliance } from '../compliance/complianceEvaluator.js';
import { notifyComplianceFinding } from '../notifications/complianceNotificationService.js';

let tickInFlight = false;
let intervalRef = null;

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
      const findings = evaluateCompliance({
        fleetVehicleId,
        companyId,
        routineNextService: routineByVehicle.get(fleetVehicleId) || null,
        complianceItems: complianceByVehicle.get(fleetVehicleId) || [],
      });
      for (const finding of findings) {
        await notifyComplianceFinding({
          finding,
          vehicle: { name: vehicle.name, plateNumber: vehicle.plateNumber },
          companyId,
        });
      }
    }
  }
}

export function startComplianceNotificationScheduler() {
  if (!isEnabled()) {
    return () => {};
  }

  const pollMs = Math.max(60_000, Number(process.env.COMPLIANCE_NOTIFICATION_POLL_MS) || 10 * 60_000);
  const tick = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    try {
      await runOnce();
    } catch (error) {
      console.error('[compliance-notify] poll failed', error?.message || error);
    } finally {
      tickInFlight = false;
    }
  };

  void tick();
  intervalRef = setInterval(tick, pollMs);
  return () => {
    if (intervalRef) {
      clearInterval(intervalRef);
      intervalRef = null;
    }
  };
}
