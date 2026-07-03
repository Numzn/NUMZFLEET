import { Box } from '@mui/material';
import VehicleOverviewKpiRow from './VehicleOverviewKpiRow.jsx';
import VehicleMaintenanceOverviewPanel from './VehicleMaintenanceOverviewPanel.jsx';
import VehicleServiceRemindersTimeline from './VehicleServiceRemindersTimeline.jsx';
import VehicleDigitalEnginePlaceholder from './VehicleDigitalEnginePlaceholder.jsx';
import VehicleOperationalActivityPanel from './VehicleOperationalActivityPanel.jsx';
import VehicleNotesFooter from './VehicleNotesFooter.jsx';
import useVehicleWorkspaceDensity from '../hooks/useVehicleWorkspaceDensity.js';
import { useAttributePreference } from '../../../common/util/preferences';
import { useTranslation } from '../../../common/components/LocalizationProvider';

export default function VehicleOverviewTab(props) {
  const {
    vehicle,
    telemetry,
    fuel,
    fuelPerformance,
    fuelPerformanceLoading,
    maintenance,
    serviceHistory,
    alerts,
    todayRefuel,
    fuelRequests,
    lastRefill,
    todayTrips,
    linkedDrivers,
    livePosition,
    overviewMetrics,
    overviewMetricsLoading,
    vehicleEngine,
    onSaveNotes,
    notesSaving,
  } = props;

  const { sectionGap } = useVehicleWorkspaceDensity();
  const distanceUnit = useAttributePreference('distanceUnit');
  const t = useTranslation();
  const routineConfigured = vehicleEngine?.engine?.maintenance?.routineServiceConfigured === true;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      <VehicleOverviewKpiRow
        fuelPerformance={fuelPerformance}
        fuelPerformanceLoading={fuelPerformanceLoading}
        fuelSpecEfficiency={fuel?.fuelEfficiencyKmL}
        serviceRecords={serviceHistory.records}
        maintenanceItems={maintenance.items}
        overviewMetrics={overviewMetrics}
        overviewMetricsLoading={overviewMetricsLoading}
        vehicleEngine={vehicleEngine}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <VehicleMaintenanceOverviewPanel
          maintenanceItems={routineConfigured ? [] : maintenance.items}
          serviceRecords={serviceHistory.records}
          openWorkOrders={maintenance.openWorkOrders}
          recentRepairs={vehicleEngine?.hub?.repairs?.recentCompleted}
          loading={maintenance.loading || serviceHistory.loading}
          hidden={routineConfigured}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!routineConfigured ? (
            <VehicleServiceRemindersTimeline
              maintenanceItems={maintenance.items}
              odometerKm={vehicleEngine?.registry?.odometerKm ?? null}
              distanceUnit={distanceUnit}
              t={t}
            />
          ) : null}
          <VehicleDigitalEnginePlaceholder
            telemetry={telemetry}
            vehicle={vehicle}
            livePosition={livePosition}
            fuelPerformance={fuelPerformance}
            maintenanceItems={maintenance.items}
            intelligence={vehicleEngine?.intelligence}
            engineHealth={vehicleEngine?.engine?.health}
          />
        </Box>
        <VehicleOperationalActivityPanel
          engineActivities={vehicleEngine?.engine?.activity?.activities ?? []}
          activityLoading={vehicleEngine?.loading}
          alerts={alerts}
          todayRefuel={todayRefuel}
          fuelRequests={fuelRequests}
          lastRefill={lastRefill}
          todayTrips={todayTrips?.trips}
          tripsLoading={todayTrips?.loading}
          linkedDrivers={linkedDrivers}
        />
      </Box>

      <VehicleNotesFooter
        notes={vehicle?.notes}
        onSave={onSaveNotes}
        readOnly={!onSaveNotes}
        saving={notesSaving}
      />
    </Box>
  );
}
