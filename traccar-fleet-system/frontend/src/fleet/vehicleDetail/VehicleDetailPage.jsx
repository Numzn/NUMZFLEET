import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager } from '../../common/util/permissions';
import useVehicleData from './useVehicleData';
import { useLinkedGeofences } from './useLinkedGeofences.js';
import VehicleWorkspaceSkeleton from './VehicleWorkspaceSkeleton.jsx';
import VehicleWorkspaceTabs from './VehicleWorkspaceTabs.jsx';

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

function VehicleWorkspaceBody(props) {
  const { refresh, ...rest } = props;
  return <VehicleWorkspaceTabs {...rest} onRefreshVehicle={refresh} />;
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
    geofenceAlertsHidden,
    geofenceAlertsSuppressed,
    loading,
    error,
    refresh,
    livePosition,
    deviceId,
    motionLabel,
    motionDurationLabel,
    ignitionPhrase,
  } = useVehicleData(vehicleId);

  const {
    linkedGeofences,
    loading: linkedZonesLoading,
  } = useLinkedGeofences(deviceId);
  const linkedZoneCount = linkedGeofences?.length ?? 0;

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
            geofenceAlertsHidden={geofenceAlertsHidden}
            geofenceAlertsSuppressed={geofenceAlertsSuppressed}
            linkedZoneCount={linkedZoneCount}
            linkedZonesLoading={linkedZonesLoading}
            livePosition={livePosition}
            deviceId={deviceId}
            motionLabel={motionLabel}
            motionDurationLabel={motionDurationLabel}
            ignitionPhrase={ignitionPhrase}
            fleetVehicleId={vehicle?.id ?? vehicleId}
            refresh={refresh}
          />
        )}

        {!loading && !error && !vehicle && (
          <Alert severity="warning">Vehicle not found or access denied.</Alert>
        )}
      </FleetWorkspaceShell>
    </Box>
  );
}
