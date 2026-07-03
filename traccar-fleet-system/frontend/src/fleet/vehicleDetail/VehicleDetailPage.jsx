import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager } from '../../common/util/permissions';
import useVehicleWorkspaceData from './hooks/useVehicleWorkspaceData.js';
import VehicleWorkspaceSkeleton from './VehicleWorkspaceSkeleton.jsx';
import VehicleWorkspaceTabs from './VehicleWorkspaceTabs.jsx';
import { patchVehicleFields } from '../vehiclesApi.js';

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

export default function VehicleDetailPage() {
  const { classes } = useStyles();
  const { vehicleId } = useParams();
  const manager = useManager();
  const user = useSelector((s) => s.session.user);
  const [notesSaving, setNotesSaving] = useState(false);

  const ws = useVehicleWorkspaceData(vehicleId);
  const { refresh, fleetVehicleId: wsFleetId } = ws;

  const handleSaveNotes = useCallback(async (notes) => {
    if (!user || !wsFleetId) return;
    setNotesSaving(true);
    try {
      await patchVehicleFields(user, wsFleetId, { notes });
      await refresh();
    } finally {
      setNotesSaving(false);
    }
  }, [user, wsFleetId, refresh]);

  if (!manager) {
    return (
      <Container maxWidth="md" className={classes.container}>
        <FleetWorkspaceShell>
          <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
        </FleetWorkspaceShell>
      </Container>
    );
  }

  const showSkeleton = ws.loading && !ws.vehicle;
  const showError = !ws.loading && ws.error && !ws.vehicle;
  const showBody = Boolean(ws.vehicle);

  return (
    <Box className={classes.container} sx={{ width: '100%', maxWidth: '100%' }}>
      <FleetWorkspaceShell>
        {showSkeleton && <VehicleWorkspaceSkeleton />}

        {showError && (
          <VehicleWorkspaceError error={ws.error} onRetry={ws.refresh} />
        )}

        {showBody && (
          <VehicleWorkspaceTabs
            vehicle={ws.vehicle}
            telemetry={ws.telemetry}
            fuel={ws.fuel}
            erb={ws.erb}
            alerts={ws.alerts}
            livePosition={ws.livePosition}
            deviceId={ws.deviceId}
            linkedDrivers={ws.linkedDrivers}
            groupName={ws.groupName}
            fleetVehicleId={ws.fleetVehicleId}
            onRefreshVehicle={ws.refresh}
            maintenance={ws.maintenance}
            serviceHistory={ws.serviceHistory}
            handleMaintenanceCompleted={ws.handleMaintenanceCompleted}
            fuelPerformance={ws.fuelPerformance}
            fuelPerformanceLoading={ws.fuelPerformanceLoading}
            todayRefuel={ws.todayRefuel}
            fuelRequests={ws.fuelRequests}
            lastRefill={ws.lastRefill}
            todayTrips={ws.todayTrips}
            openServiceCount={ws.openServiceCount}
            overviewMetrics={ws.overviewMetrics}
            overviewMetricsLoading={ws.overviewMetricsLoading}
            vehicleEngine={ws.vehicleEngine}
            onSaveNotes={handleSaveNotes}
            notesSaving={notesSaving}
          />
        )}

        {!ws.loading && !ws.error && !ws.vehicle && (
          <Alert severity="warning">Vehicle not found or access denied.</Alert>
        )}
      </FleetWorkspaceShell>
    </Box>
  );
}
