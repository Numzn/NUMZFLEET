import { useState } from 'react';
import { Box, Tab, Tabs, Badge } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useManager } from '../../common/util/permissions';
import VehicleWorkspaceLayout from './VehicleWorkspaceLayout.jsx';
import VehicleWorkspaceMobileNav from './VehicleWorkspaceMobileNav.jsx';
import VehicleWorkspaceMoreSheet from './VehicleWorkspaceMoreSheet.jsx';
import VehicleOverviewTab from './overview/VehicleOverviewTab.jsx';
import VehicleFuelTab from './VehicleFuelTab.jsx';
import VehicleMaintenanceTab from './VehicleMaintenanceTab.jsx';
import VehicleServiceHistory from './VehicleServiceHistory.jsx';
import VehicleDocumentsPanel from './VehicleDocumentsPanel.jsx';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';
import useVehicleWorkspaceTab from './hooks/useVehicleWorkspaceTab.js';
import {
  VEHICLE_WORKSPACE_TABS,
  VEHICLE_WORKSPACE_TAB_IDS,
  getTabBadge,
} from './vehicleWorkspaceTabRegistry.js';

export default function VehicleWorkspaceTabs(props) {
  const {
    vehicle,
    telemetry,
    fuel,
    erb,
    alerts,
    livePosition,
    deviceId,
    linkedDrivers,
    groupName,
    fleetVehicleId,
    onRefreshVehicle,
    maintenance,
    serviceHistory,
    handleMaintenanceCompleted,
    fuelPerformance,
    fuelPerformanceLoading,
    todayRefuel,
    fuelRequests,
    lastRefill,
    todayTrips,
    openServiceCount,
    overviewMetrics,
    overviewMetricsLoading,
    vehicleEngine,
    onSaveNotes,
    notesSaving,
  } = props;

  const canManage = useManager();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { sectionGap } = useVehicleWorkspaceDensity();
  const { tab, setTab } = useVehicleWorkspaceTab();
  const [moreOpen, setMoreOpen] = useState(false);

  const badgeContext = {
    dueSoonCount: maintenance.dueSoonCount,
    openServiceCount,
  };

  const renderTabPanel = () => {
    switch (tab) {
      case VEHICLE_WORKSPACE_TAB_IDS.overview:
        return (
          <VehicleOverviewTab
            vehicle={vehicle}
            telemetry={telemetry}
            fuel={fuel}
            fuelPerformance={fuelPerformance}
            fuelPerformanceLoading={fuelPerformanceLoading}
            maintenance={maintenance}
            serviceHistory={serviceHistory}
            alerts={alerts}
            todayRefuel={todayRefuel}
            fuelRequests={fuelRequests}
            lastRefill={lastRefill}
            todayTrips={todayTrips}
            linkedDrivers={linkedDrivers}
            livePosition={livePosition}
            overviewMetrics={overviewMetrics}
            overviewMetricsLoading={overviewMetricsLoading}
            vehicleEngine={vehicleEngine}
            onSaveNotes={onSaveNotes}
            notesSaving={notesSaving}
          />
        );

      case VEHICLE_WORKSPACE_TAB_IDS.maintenance:
        return (
          <VehicleMaintenanceTab
            vehicleEngine={vehicleEngine}
            maintenance={maintenance}
            fleetVehicleId={vehicle?.id}
            deviceId={deviceId}
            canManage={canManage}
            onCompleted={handleMaintenanceCompleted}
          />
        );

      case VEHICLE_WORKSPACE_TAB_IDS.repairs: {
        const routineScheduleItem = (maintenance?.items ?? []).find(
          (item) => item.attributes?.numzServicePackage === true,
        ) ?? null;
        return (
          <VehicleServiceHistory
            fleetVehicleId={vehicle?.id}
            records={serviceHistory.records}
            loading={serviceHistory.loading}
            error={serviceHistory.error}
            reload={serviceHistory.reload}
            routineMaintenanceId={
              routineScheduleItem?.id
              ?? vehicleEngine?.engine?.maintenance?.nextService?.maintenanceId
              ?? null
            }
          />
        );
      }

      case VEHICLE_WORKSPACE_TAB_IDS.documents:
        return (
          <VehicleDocumentsPanel fleetVehicleId={fleetVehicleId} />
        );

      case VEHICLE_WORKSPACE_TAB_IDS.fuel:
        return (
          <VehicleFuelTab
            vehicle={vehicle}
            fuel={fuel}
            erb={erb}
            deviceId={deviceId}
            fuelPerformance={fuelPerformance}
            fuelPerformanceLoading={fuelPerformanceLoading}
            vehicleEngine={vehicleEngine}
            lastRefill={lastRefill}
          />
        );

      default:
        return null;
    }
  };

  return (
    <VehicleWorkspaceLayout
      vehicle={vehicle}
      telemetry={telemetry}
      fuel={fuel}
      fuelPerformance={fuelPerformance}
      fuelPerformanceLoading={fuelPerformanceLoading}
      livePosition={livePosition}
      deviceId={deviceId}
      linkedDrivers={linkedDrivers}
      groupName={groupName}
      maintenanceItems={maintenance.items}
      vehicleEngine={vehicleEngine}
      onRefreshVehicle={onRefreshVehicle}
      mobileNav={(
        <>
          <VehicleWorkspaceMobileNav
            tab={tab}
            onTabChange={setTab}
            onMoreOpen={() => setMoreOpen(true)}
            badgeContext={badgeContext}
          />
          <VehicleWorkspaceMoreSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            tab={tab}
            onTabChange={setTab}
            badgeContext={badgeContext}
          />
        </>
      )}
    >
      {!isMobile && (
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          {VEHICLE_WORKSPACE_TABS.map((tabDef) => {
            const badge = getTabBadge(tabDef.id, badgeContext);
            return (
              <Tab
                key={tabDef.id}
                label={(
                  <Badge badgeContent={badge} color="error" max={99}>
                    <Box component="span" sx={{ pr: badge ? 1.5 : 0 }}>
                      {tabDef.label}
                    </Box>
                  </Badge>
                )}
                value={tabDef.id}
              />
            );
          })}
        </Tabs>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
        {renderTabPanel()}
      </Box>
    </VehicleWorkspaceLayout>
  );
}
