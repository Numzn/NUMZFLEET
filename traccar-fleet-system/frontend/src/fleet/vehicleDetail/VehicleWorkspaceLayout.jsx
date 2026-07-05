import { Box } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import VehicleWorkspaceHeader from './VehicleWorkspaceHeader.jsx';
import VehicleWorkspaceHero from './VehicleWorkspaceHero.jsx';
import VehicleHealthSidebar from './VehicleHealthSidebar.jsx';

export default function VehicleWorkspaceLayout({
  vehicle,
  telemetry,
  fuel,
  fuelPerformance,
  fuelPerformanceLoading,
  livePosition,
  deviceId,
  linkedDrivers,
  groupName,
  maintenanceItems,
  vehicleEngine,
  children,
  mobileNav,
  onRefreshVehicle,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const online = vehicle?.device?.status === 'online';

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        pb: isMobile
          ? 'calc(var(--app-bottomnav-height, 0px) + env(safe-area-inset-bottom, 0px) + 16px)'
          : 2,
      }}
    >
      <VehicleWorkspaceHeader vehicle={vehicle} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 300px' },
          gap: 2,
          mb: 2,
          alignItems: 'stretch',
        }}
      >
        <VehicleWorkspaceHero
          vehicle={vehicle}
          telemetry={telemetry}
          fuel={fuel}
          fuelPerformance={fuelPerformance}
          fuelPerformanceLoading={fuelPerformanceLoading}
          livePosition={livePosition}
          deviceId={deviceId}
          linkedDrivers={linkedDrivers}
          groupName={groupName}
          nextService={vehicleEngine?.engine?.maintenance?.nextService ?? null}
          nextServiceLoading={Boolean(vehicleEngine?.loading)}
          onPhotoUpdated={onRefreshVehicle}
        />
        <VehicleHealthSidebar
          telemetry={telemetry}
          maintenanceItems={maintenanceItems}
          fuelPerformance={fuelPerformance}
          online={online}
          vehicleEngine={vehicleEngine}
        />
      </Box>

      {children}

      {isMobile && mobileNav}
    </Box>
  );
}
