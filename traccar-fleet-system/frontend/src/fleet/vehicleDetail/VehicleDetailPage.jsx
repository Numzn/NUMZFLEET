import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Container, LinearProgress } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import AppLayout from '../../common/components/AppLayout';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager } from '../../common/util/permissions';
import useVehicleData from './useVehicleData';
import VehicleOperationalHero from './VehicleOperationalHero';
import VehicleCommandDock from './VehicleCommandDock';
import LiveStatusModule from './LiveStatusModule';
import AlertsModule from './AlertsModule';
import VehicleDriverSection from './VehicleDriverSection';
import TripsModule from './TripsModule';
import FuelModule from './FuelModule';
import HealthModule from './HealthModule';
import VehicleConfigPanel from './VehicleConfigPanel';
import VehicleWorkspaceMobileNav from './VehicleWorkspaceMobileNav';

const useStyles = makeStyles()((theme) => ({
  container: {
    padding: theme.spacing(2),
  },
}));

const mobileScrollPaddingBottom =
  'calc(var(--app-bottomnav-height, 0px) + env(safe-area-inset-bottom, 0px) + 24px)';

export default function VehicleDetailPage() {
  const { classes } = useStyles();
  const { vehicleId } = useParams();
  const manager = useManager();
  const theme = useTheme();
  const isMobileWorkspace = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileTab, setMobileTab] = useState(0);

  const {
    vehicle,
    telemetry,
    fuel,
    erb,
    alerts,
    loading,
    error,
    refresh,
    saveConfig,
    livePosition,
    deviceId,
    groupName,
    motionLabel,
    ignitionPhrase,
  } = useVehicleData(vehicleId);

  const liveZone = vehicle ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <VehicleOperationalHero
        vehicle={vehicle}
        fuel={fuel}
        telemetry={telemetry}
        motionLabel={motionLabel}
        ignitionPhrase={ignitionPhrase}
        groupName={groupName}
        deviceId={deviceId}
      />
      <VehicleCommandDock deviceId={deviceId} livePosition={livePosition} />
      <LiveStatusModule vehicle={vehicle} telemetry={telemetry} livePosition={livePosition} />
      <AlertsModule alerts={alerts} />
      <VehicleDriverSection
        vehicle={vehicle}
        deviceId={deviceId}
        telemetry={telemetry}
        onRefreshVehicle={refresh}
      />
    </Box>
  ) : null;

  const tripsBlock = vehicle ? <TripsModule deviceId={deviceId} /> : null;

  const fuelBlock = vehicle ? (
    <FuelModule fuel={fuel} erb={erb} vehicleSpec={vehicle.vehicleSpec} />
  ) : null;

  const healthBlock = vehicle ? <HealthModule telemetry={telemetry} /> : null;

  const setupBlock = vehicle ? (
    <VehicleConfigPanel vehicle={vehicle} saveConfig={saveConfig} />
  ) : null;

  const desktopBody = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
      {liveZone}
      {fuelBlock}
      {healthBlock}
      {setupBlock}
    </Box>
  );

  const mobileBodies = [liveZone, tripsBlock, fuelBlock, healthBlock, setupBlock];

  if (!manager) {
    return (
      <AppLayout showSidebar>
        <Container maxWidth="md" className={classes.container}>
          <FleetWorkspaceShell>
            <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
          </FleetWorkspaceShell>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout showSidebar>
      <Container maxWidth={false} className={classes.container} sx={{ maxWidth: 1800, mx: 'auto' }}>
        <FleetWorkspaceShell>
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {vehicle &&
            (isMobileWorkspace ? (
              <>
                <Box sx={{ pb: mobileScrollPaddingBottom }}>{mobileBodies[mobileTab]}</Box>
                <VehicleWorkspaceMobileNav tabIndex={mobileTab} onTabChange={setMobileTab} />
              </>
            ) : (
              desktopBody
            ))}
          {!loading && !error && !vehicle && (
            <Alert severity="warning">Vehicle not found or access denied.</Alert>
          )}
        </FleetWorkspaceShell>
      </Container>
    </AppLayout>
  );
}
