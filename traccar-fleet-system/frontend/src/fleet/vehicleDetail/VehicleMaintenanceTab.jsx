import { Alert, Box } from '@mui/material';
import RoutineServiceOpsPanel from './RoutineServiceOpsPanel.jsx';

export default function VehicleMaintenanceTab({
  vehicleEngine,
  maintenance,
  fleetVehicleId,
  deviceId,
  canManage,
  onCompleted,
  user,
}) {
  const loading = vehicleEngine?.loading || maintenance?.loading;
  const capabilities = vehicleEngine?.capabilities;
  const engineMaint = vehicleEngine?.engine?.maintenance;
  const nextService = engineMaint?.nextService;
  const routineServiceConfigured = engineMaint?.routineServiceConfigured === true;
  const currentOdometerKm = vehicleEngine?.registry?.odometerKm ?? null;
  const maintenanceSupported = capabilities?.maintenance !== false;

  const routineScheduleItem = (maintenance?.items ?? []).find(
    (item) => item.attributes?.numzServicePackage === true,
  ) ?? null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!maintenanceSupported && (
        <Alert severity="info">
          Assign a tracker to this vehicle to enable Routine Service monitoring.
        </Alert>
      )}

      <RoutineServiceOpsPanel
        nextService={nextService}
        routineServiceConfigured={routineServiceConfigured}
        currentOdometerKm={currentOdometerKm}
        routineScheduleItem={routineScheduleItem}
        fleetVehicleId={fleetVehicleId}
        deviceId={deviceId}
        canManage={canManage}
        user={user}
        onCompleted={onCompleted}
        loading={loading}
      />
    </Box>
  );
}
