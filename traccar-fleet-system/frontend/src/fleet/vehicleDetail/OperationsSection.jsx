import { Box, Typography } from '@mui/material';
import VehicleAlertsColumn from './VehicleAlertsColumn.jsx';
import VehicleFuelColumn from './VehicleFuelColumn.jsx';
import useVehicleWorkspaceDensity from './hooks/useVehicleWorkspaceDensity.js';

export default function OperationsSection({
  alerts,
  deviceId,
  fleetVehicleId,
  fuel,
  erb,
  geofenceAlertsHidden,
  geofenceAlertsSuppressed,
}) {
  const { operationsGridColumns } = useVehicleWorkspaceDensity();

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 'var(--space-3)', color: 'var(--color-text-primary)' }}>
        Operations
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: operationsGridColumns,
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        <VehicleAlertsColumn
          alerts={alerts}
          deviceId={deviceId}
          geofenceAlertsHidden={geofenceAlertsHidden}
          geofenceAlertsSuppressed={geofenceAlertsSuppressed}
        />
        <VehicleFuelColumn
          deviceId={deviceId}
          fleetVehicleId={fleetVehicleId}
          fuel={fuel}
          erb={erb}
        />
      </Box>
    </Box>
  );
}
