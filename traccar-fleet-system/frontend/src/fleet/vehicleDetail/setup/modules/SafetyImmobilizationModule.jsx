import { Alert, Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { vehicleImmobilizerPath } from '../../../vehicleRegistry/vehicleRegistryUtils.js';
import { describeImmobilizationCapabilities } from '../../immobilizationDisplayUtils.js';

export default function SafetyImmobilizationModule({
  vehicleId,
  capabilities,
  capabilitiesLoading,
  canSaveSpecs,
}) {
  const navigate = useNavigate();
  const capView = describeImmobilizationCapabilities(capabilities);

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
      {!capabilitiesLoading && capabilities?.canImmobilize && (
        <Alert severity="success" sx={{ mb: 2 }}>
          This device supports remote immobilization via the immobilizer workspace.
        </Alert>
      )}
      {!capabilitiesLoading && capabilities && !capabilities.canImmobilize && capView.summary && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {capView.summary}
          {capView.detail ? ` ${capView.detail}` : ''}
        </Typography>
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
