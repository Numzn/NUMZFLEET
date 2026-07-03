import useVehicleData from '../useVehicleData.js';
import { useLinkedGeofences } from '../useLinkedGeofences.js';
import { useLinkedDrivers } from '../useVehicleDriver.js';
import useVehicleEngine from './useVehicleEngine.js';
import useVehicleServiceHistory from './useVehicleServiceHistory.js';
import useLastRefill from './useLastRefill.js';
import useTodayOperationRefuel from './useTodayOperationRefuel.js';
import useVehicleFuelRequests from './useVehicleFuelRequests.js';
import useVehicleTodayTrips from './useVehicleTodayTrips.js';

/**
 * Composite hook — single fetch orchestration for vehicle workspace.
 * Vehicle intelligence comes from useVehicleEngine (server Vehicle Engine API).
 */
export default function useVehicleWorkspaceData(vehicleId) {
  const core = useVehicleData(vehicleId);
  const { deviceId, vehicle } = core;
  const fleetVehicleId = vehicle?.id ?? vehicleId;

  const vehicleEngine = useVehicleEngine(fleetVehicleId, {
    deviceId,
    livePosition: core.livePosition,
  });
  const linkedGeofences = useLinkedGeofences(deviceId);
  const linkedDrivers = useLinkedDrivers(deviceId);
  const lastRefill = useLastRefill(deviceId);
  const todayRefuel = useTodayOperationRefuel(deviceId);
  const fuelRequests = useVehicleFuelRequests(deviceId);
  const todayTrips = useVehicleTodayTrips(deviceId);
  const serviceHistory = useVehicleServiceHistory(fleetVehicleId);

  const woSummary = vehicleEngine.maintenance.summary;
  const openServiceCount = vehicleEngine.engine?.maintenance?.openWorkOrders
    ?? ((Number(woSummary?.open) || 0) + (Number(woSummary?.inProgress) || 0));

  const fuel = vehicleEngine.fuelSnapshot ?? core.fuelFallback;

  const handleMaintenanceCompleted = async () => {
    await vehicleEngine.reload({ silent: true });
    await serviceHistory.reload();
    await core.refresh();
  };

  return {
    ...core,
    fuel,
    fleetVehicleId,
    vehicleEngine,
    linkedGeofences: linkedGeofences.linkedGeofences,
    linkedZonesLoading: linkedGeofences.loading,
    linkedZoneCount: linkedGeofences.linkedGeofences?.length ?? 0,
    linkedDrivers: linkedDrivers.linkedDrivers,
    linkedDriversLoading: linkedDrivers.loading,
    reloadLinkedDrivers: linkedDrivers.reloadLinked,
    lastRefill: lastRefill.lastRefill,
    lastRefillLoading: lastRefill.loading,
    todayRefuel,
    fuelRequests,
    todayTrips,
    fuelPerformance: vehicleEngine.fuelPerformance,
    fuelPerformanceLoading: vehicleEngine.initialLoading,
    fuelPerformanceError: vehicleEngine.error,
    fuelPerformanceStats: vehicleEngine.hub?.fuel ?? null,
    reloadFuelPerformance: vehicleEngine.reload,
    maintenance: {
      ...vehicleEngine.maintenance,
      reload: vehicleEngine.reload,
      error: vehicleEngine.error,
    },
    serviceHistory,
    openServiceCount,
    overviewMetrics: vehicleEngine.overviewMetrics,
    overviewMetricsLoading: vehicleEngine.initialLoading,
    handleMaintenanceCompleted,
  };
}
