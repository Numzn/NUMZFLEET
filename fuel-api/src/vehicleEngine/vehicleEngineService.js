import { getVehicleMerged } from '../services/vehicleFleetService.js';
import { resolveVehicleOdometer } from './odometer/resolveVehicleOdometer.js';
import { buildRegistry } from './registryBuilder.js';
import { buildCapabilities } from './capabilitiesBuilder.js';
import { buildTelemetryHub } from './hub/telemetryHub.js';
import { buildFuelHub } from './hub/fuelHub.js';
import { buildMaintenanceHub } from './hub/maintenanceHub.js';
import { buildRepairsHub } from './hub/repairsHub.js';
import { buildComplianceHub } from './hub/complianceHub.js';
import { buildHealthEngine } from './engine/healthEngine.js';
import { buildMaintenanceEngine } from './engine/maintenanceEngine.js';
import { buildFuelEngine } from './engine/fuelEngine.js';
import { loadFuelLearningState } from './fuel/fuelLearningService.js';
import { buildStatusEngine } from './engine/statusEngine.js';
import { buildIntelligence } from './intelligenceBuilder.js';
import { buildTimeline } from './timelineBuilder.js';
import { notifyRoutineServiceState } from '../notifications/maintenanceNotificationService.js';
import { evaluateCompliance } from '../compliance/complianceEvaluator.js';
import { buildActivityHub } from './activity/buildActivityHub.js';
import { buildActivityEngine } from './activity/buildActivityEngine.js';

export async function getVehicleEngine(fleetVehicleId, companyId) {
  const merged = await getVehicleMerged(fleetVehicleId, companyId);
  if (!merged) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }

  const deviceId = merged?.assignment?.deviceId ?? null;
  const odometerState = await resolveVehicleOdometer({ merged, deviceId });
  const registry = buildRegistry(merged, odometerState);

  const [maintenance, repairs, fuel, activityHub] = await Promise.all([
    buildMaintenanceHub(companyId, fleetVehicleId),
    buildRepairsHub(companyId, fleetVehicleId),
    buildFuelHub(deviceId, merged),
    buildActivityHub(deviceId),
  ]);

  const telemetry = buildTelemetryHub(merged);

  const hub = {
    telemetry,
    fuel,
    maintenance,
    repairs,
    activity: activityHub,
  };

  const capabilities = buildCapabilities(registry, hub);

  const learning = fleetVehicleId
    ? await loadFuelLearningState(fleetVehicleId)
    : null;

  const [fuelEngine, health, timeline, complianceHub] = await Promise.all([
    buildFuelEngine(companyId, hub, registry, { learning }),
    Promise.resolve(buildHealthEngine({ hub, registry })),
    buildTimeline({ registry, hub, deviceId }),
    buildComplianceHub(companyId, fleetVehicleId),
  ]);

  const maintenanceEngine = buildMaintenanceEngine(hub, registry);
  const activityEngine = buildActivityEngine(hub.activity);
  const status = buildStatusEngine(registry, telemetry);

  const engine = {
    status,
    health,
    maintenance: maintenanceEngine,
    activity: activityEngine,
    fuel: fuelEngine,
    costs: {
      maintenanceMtd: maintenance.costs.mtd,
      maintenanceYtd: maintenance.costs.ytd,
      maintenanceLifetime: maintenance.costs.lifetime,
    },
  };

  // Option B boundary: Vehicle Engine aggregates document/compliance facts first,
  // then Intelligence consumes derived signals from this aggregated state.
  const compliance = evaluateCompliance({
    fleetVehicleId,
    companyId,
    routineNextService: engine.maintenance?.nextService ?? null,
    complianceItems: complianceHub.items,
  });

  const snapshot = {
    updatedAt: new Date().toISOString(),
    registry,
    capabilities,
    hub,
    engine,
    compliance,
    intelligence: buildIntelligence(engine, {
      complianceFindings: compliance,
      registry,
      hub,
      activityAnomalies: activityEngine.anomalies,
    }),
    timeline,
  };

  try {
    await notifyRoutineServiceState({
      fleetVehicleId,
      nextService: snapshot.engine?.maintenance?.nextService,
      vehicle: { name: merged?.name ?? null, plateNumber: merged?.plateNumber ?? null },
      companyId,
    });
  } catch (error) {
    console.error('Failed to publish routine service state notification:', error?.message || error);
  }

  return snapshot;
}

export default { getVehicleEngine };
