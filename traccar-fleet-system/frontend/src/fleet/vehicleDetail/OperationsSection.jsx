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
}) {
  const { operationsGridColumns } = useVehicleWorkspaceDensity();

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Operations
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: operationsGridColumns,
          gap: 2,
          alignItems: 'start',
        }}
      >
        <VehicleAlertsColumn alerts={alerts} deviceId={deviceId} />
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
