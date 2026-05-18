import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager } from '../../common/util/permissions';
import useVehicleData from './useVehicleData';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';
import VehicleWorkspaceSkeleton from './VehicleWorkspaceSkeleton.jsx';
import VehicleOperationsCard from './VehicleOperationsCard.jsx';
import OperationsSection from './OperationsSection.jsx';
import DiagnosticsSection from './DiagnosticsSection.jsx';

const useStyles = makeStyles()(() => ({
  container: {
    padding: 0,
  },
}));

function VehicleWorkspaceError({ error, onRetry }) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 6,
        px: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Unable to load vehicle data
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {error || 'An unexpected error occurred.'}
      </Typography>
      <Button variant="contained" onClick={onRetry}>
        Retry
      </Button>
    </Box>
  );
}

function VehicleWorkspaceBody({
  vehicle,
  telemetry,
  fuel,
  erb,
  alerts,
  livePosition,
  deviceId,
  motionLabel,
  ignitionPhrase,
  fleetVehicleId,
}) {
  const { sectionGap } = useVehicleWorkspaceDensity();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: sectionGap, pb: 2 }}>
      <VehicleOperationsCard
        vehicle={vehicle}
        fuel={fuel}
        telemetry={telemetry}
        motionLabel={motionLabel}
        ignitionPhrase={ignitionPhrase}
        livePosition={livePosition}
        deviceId={deviceId}
      />
      <OperationsSection
        alerts={alerts}
        deviceId={deviceId}
        fleetVehicleId={fleetVehicleId ?? vehicle?.id}
        fuel={fuel}
        erb={erb}
      />
      <DiagnosticsSection telemetry={telemetry} />
    </Box>
  );
}

export default function VehicleDetailPage() {
  const { classes } = useStyles();
  const { vehicleId } = useParams();
  const manager = useManager();

  const {
    vehicle,
    telemetry,
    fuel,
    erb,
    alerts,
    loading,
    error,
    refresh,
    livePosition,
    deviceId,
    motionLabel,
    ignitionPhrase,
  } = useVehicleData(vehicleId);

  if (!manager) {
    return (
      <Container maxWidth="md" className={classes.container}>
        <FleetWorkspaceShell>
          <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
        </FleetWorkspaceShell>
      </Container>
    );
  }

  const showSkeleton = loading && !vehicle;
  const showError = !loading && error && !vehicle;
  const showBody = Boolean(vehicle);

  return (
    <Box className={classes.container} sx={{ width: '100%', maxWidth: '100%' }}>
      <FleetWorkspaceShell>
        {showSkeleton && <VehicleWorkspaceSkeleton />}

        {showError && (
          <VehicleWorkspaceError error={error} onRetry={refresh} />
        )}

        {showBody && (
          <VehicleWorkspaceBody
            vehicle={vehicle}
            telemetry={telemetry}
            fuel={fuel}
            erb={erb}
            alerts={alerts}
            livePosition={livePosition}
            deviceId={deviceId}
            motionLabel={motionLabel}
            ignitionPhrase={ignitionPhrase}
            fleetVehicleId={vehicle?.id ?? vehicleId}
          />
        )}

        {!loading && !error && !vehicle && (
          <Alert severity="warning">Vehicle not found or access denied.</Alert>
        )}
      </FleetWorkspaceShell>
    </Box>
  );
}
