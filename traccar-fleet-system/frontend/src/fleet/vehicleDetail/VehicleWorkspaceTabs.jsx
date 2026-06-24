import { useState } from 'react';
import { Box, Button, Tab, Tabs, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useManager, useTechnician } from '../../common/util/permissions';
import VehicleOperationsCard from './VehicleOperationsCard.jsx';
import VehicleFuelColumn from './VehicleFuelColumn.jsx';
import VehicleAlertsColumn from './VehicleAlertsColumn.jsx';
import DiagnosticsSection from './DiagnosticsSection.jsx';
import DeviceTelemetryModule from './setup/modules/DeviceTelemetryModule.jsx';
import DriverSetupModule from './setup/modules/DriverSetupModule.jsx';
import VehicleAssignmentHistory from './VehicleAssignmentHistory.jsx';
import VehicleServiceHistory from './VehicleServiceHistory.jsx';
import VehicleMaintenanceCard from './VehicleMaintenanceCard.jsx';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';
import useVehicleMaintenance from './hooks/useVehicleMaintenance.js';
import useVehicleServiceHistory from './hooks/useVehicleServiceHistory.js';
import useLastRefill from './hooks/useLastRefill.js';
import useVehicleFuelPerformance from './hooks/useVehicleFuelPerformance.js';

const TAB_OVERVIEW = 'overview';
const TAB_DRIVER = 'driver';
const TAB_FUEL = 'fuel';
const TAB_OPERATIONS = 'operations';
const TAB_HARDWARE = 'hardware';
const TAB_HISTORY = 'history';

export default function VehicleWorkspaceTabs(props) {
  const {
    vehicle,
    telemetry,
    fuel,
    erb,
    alerts,
    geofenceAlertsHidden,
    geofenceAlertsSuppressed,
    linkedZoneCount,
    linkedZonesLoading,
    livePosition,
    deviceId,
    motionLabel,
    motionDurationLabel,
    ignitionPhrase,
    fleetVehicleId,
    onRefreshVehicle,
  } = props;

  const technician = useTechnician();
  const canManage = useManager();
  const navigate = useNavigate();
  const { sectionGap } = useVehicleWorkspaceDensity();
  const [tab, setTab] = useState(TAB_OVERVIEW);
  const { lastRefill } = useLastRefill(deviceId);
  const fuelPerformanceHook = useVehicleFuelPerformance(vehicle?.id);
  const lastRefillMileageKm = lastRefill?.refuel?.currentMileage != null
    ? Number(lastRefill.refuel.currentMileage)
    : null;
  const maintenance = useVehicleMaintenance(deviceId, livePosition, lastRefillMileageKm);
  const serviceHistory = useVehicleServiceHistory(vehicle?.id);

  const handleMaintenanceCompleted = async () => {
    maintenance.reload();
    await serviceHistory.reload();
    await onRefreshVehicle?.();
  };

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Overview" value={TAB_OVERVIEW} />
        <Tab label="Driver" value={TAB_DRIVER} />
        <Tab label="Fuel" value={TAB_FUEL} />
        <Tab label="Operations" value={TAB_OPERATIONS} />
        {technician ? <Tab label="Tracking Hardware" value={TAB_HARDWARE} /> : null}
        <Tab label="History" value={TAB_HISTORY} />
      </Tabs>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap, pb: 2 }}>
        {tab === TAB_OVERVIEW && (
          <VehicleOperationsCard
            vehicle={vehicle}
            fuel={fuel}
            fuelPerformance={fuelPerformanceHook.fuelPerformance}
            fuelPerformanceLoading={fuelPerformanceHook.loading}
            telemetry={telemetry}
            motionLabel={motionLabel}
            motionDurationLabel={motionDurationLabel}
            ignitionPhrase={ignitionPhrase}
            livePosition={livePosition}
            deviceId={deviceId}
            maintenanceDueSoonCount={maintenance.dueSoonCount}
          />
        )}

        {tab === TAB_DRIVER && (
          <DriverSetupModule
            vehicle={vehicle}
            deviceId={deviceId}
            telemetry={telemetry}
            onRefreshVehicle={onRefreshVehicle}
          />
        )}

        {tab === TAB_FUEL && (
          <Box>
            <Typography variant="h2" sx={{ mb: 'var(--space-3)', color: 'var(--color-text-primary)' }}>
              Fuel
            </Typography>
            <VehicleFuelColumn
              deviceId={deviceId}
              fuel={fuel}
              erb={erb}
              fuelPerformance={fuelPerformanceHook.fuelPerformance}
              fuelPerformanceLoading={fuelPerformanceHook.loading}
            />
          </Box>
        )}

        {tab === TAB_OPERATIONS && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 'var(--space-3)' }}>
              <Typography variant="h2" sx={{ color: 'var(--color-text-primary)' }}>
                Operations
              </Typography>
              <Button size="small" variant="outlined" onClick={() => navigate('/fleet/operation-sessions')}>
                Today&apos;s operation
              </Button>
            </Box>
            <VehicleAlertsColumn
              alerts={alerts}
              deviceId={deviceId}
              geofenceAlertsHidden={geofenceAlertsHidden}
              geofenceAlertsSuppressed={geofenceAlertsSuppressed}
              linkedZoneCount={linkedZoneCount}
              linkedZonesLoading={linkedZonesLoading}
            />
            {deviceId && (
              <Box sx={{ mt: 2 }}>
                <VehicleMaintenanceCard
                  items={maintenance.items}
                  loading={maintenance.loading}
                  deviceId={deviceId}
                  fleetVehicleId={vehicle?.id}
                  canManage={canManage}
                  onCompleted={handleMaintenanceCompleted}
                />
              </Box>
            )}
          </Box>
        )}

        {tab === TAB_HARDWARE && technician && (
          <Box>
            <DeviceTelemetryModule
              deviceId={deviceId}
              form={{ updateIntervalSec: '' }}
              patch={() => {}}
              canSaveSpecs={false}
              vehicleId={vehicle?.id}
            />
            <Box sx={{ mt: 2 }}>
              <DiagnosticsSection telemetry={telemetry} />
            </Box>
          </Box>
        )}

        {tab === TAB_HISTORY && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Device assignments
              </Typography>
              <VehicleAssignmentHistory vehicleId={vehicle?.id} />
            </Box>
            <VehicleServiceHistory
              fleetVehicleId={vehicle?.id}
              records={serviceHistory.records}
              loading={serviceHistory.loading}
              error={serviceHistory.error}
              reload={serviceHistory.reload}
            />
          </Box>
        )}

        {tab === TAB_OVERVIEW && technician && (
          <DiagnosticsSection telemetry={telemetry} />
        )}
      </Box>
    </Box>
  );
}
