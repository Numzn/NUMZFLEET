import { Alert, Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { vehicleImmobilizerPath } from '../../../vehicleRegistry/vehicleRegistryUtils.js';

export default function SafetyImmobilizationModule({
  vehicleId,
  capabilities,
  capabilitiesLoading,
  canSaveSpecs,
}) {
  const navigate = useNavigate();

  if (!canSaveSpecs) {
    return (
      <Alert severity="info">
        Link a device to check immobilization support for this vehicle.
      </Alert>
    );
  }

  return (
    <Box>
      {capabilitiesLoading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Checking device capabilities…
        </Typography>
      )}
      {!capabilitiesLoading && capabilities && (
        <Alert
          severity={capabilities.canImmobilize ? 'success' : 'warning'}
          sx={{ mb: 2 }}
        >
          {capabilities.canImmobilize
            ? 'This device supports remote immobilization via the immobilizer workspace.'
            : capabilities.blockedReason || 'Immobilization may not be available for this device.'}
        </Alert>
      )}
      <Button
        variant="outlined"
        sx={{ textTransform: 'none', fontWeight: 600 }}
        onClick={() => vehicleId && navigate(vehicleImmobilizerPath(vehicleId))}
        disabled={!vehicleId}
      >
        Open immobilizer workspace
      </Button>
    </Box>
  );
}
