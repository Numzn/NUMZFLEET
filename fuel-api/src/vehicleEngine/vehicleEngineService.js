import { getVehicleMerged } from '../services/vehicleFleetService.js';
import { buildRegistry } from './registryBuilder.js';
import { buildCapabilities } from './capabilitiesBuilder.js';
import { buildTelemetryHub } from './hub/telemetryHub.js';
import { buildFuelHub } from './hub/fuelHub.js';
import { buildMaintenanceHub } from './hub/maintenanceHub.js';
import { buildRepairsHub } from './hub/repairsHub.js';
import { buildHealthEngine } from './engine/healthEngine.js';
import { buildMaintenanceEngine } from './engine/maintenanceEngine.js';
import { buildFuelEngine } from './engine/fuelEngine.js';
import { buildStatusEngine } from './engine/statusEngine.js';
import { buildIntelligence } from './intelligenceBuilder.js';
import { buildTimeline } from './timelineBuilder.js';

export async function getVehicleEngine(fleetVehicleId, companyId) {
  const merged = await getVehicleMerged(fleetVehicleId, companyId);
  if (!merged) {
    const err = new Error('Vehicle not found');
    err.statusCode = 404;
    throw err;
  }

  const registry = buildRegistry(merged);
  const deviceId = registry?.assignment?.deviceId ?? null;

  const [maintenance, repairs, fuel] = await Promise.all([
    buildMaintenanceHub(companyId, fleetVehicleId),
    buildRepairsHub(companyId, fleetVehicleId),
    buildFuelHub(deviceId, merged),
  ]);

  const telemetry = buildTelemetryHub(merged);

  const hub = {
    telemetry,
    fuel,
    maintenance,
    repairs,
  };

  const capabilities = buildCapabilities(registry, hub);

  const [fuelEngine, health, timeline] = await Promise.all([
    buildFuelEngine(companyId, hub, registry),
    Promise.resolve(buildHealthEngine({ hub, registry })),
    buildTimeline({ registry, hub, deviceId }),
  ]);

  const maintenanceEngine = buildMaintenanceEngine(hub);
  const status = buildStatusEngine(registry, telemetry);

  const engine = {
    status,
    health,
    maintenance: maintenanceEngine,
    fuel: fuelEngine,
    costs: {
      maintenanceMtd: maintenance.costs.mtd,
      maintenanceYtd: maintenance.costs.ytd,
      maintenanceLifetime: maintenance.costs.lifetime,
    },
  };

  return {
    updatedAt: new Date().toISOString(),
    registry,
    capabilities,
    hub,
    engine,
    intelligence: buildIntelligence(engine),
    timeline,
  };
}

export default { getVehicleEngine };
