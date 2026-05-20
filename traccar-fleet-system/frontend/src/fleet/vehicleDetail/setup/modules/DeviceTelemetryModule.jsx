import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function DeviceTelemetryModule({
  deviceId,
  form,
  patch,
  canSaveSpecs,
  vehicleId,
}) {
  const navigate = useNavigate();

  return (
    <>
      {!canSaveSpecs && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Assign a tracker from the Fleet vehicles list to unlock telemetry-based settings.
        </Alert>
      )}
      <TextField
        label="Device ID"
        value={deviceId != null ? String(deviceId) : '—'}
        fullWidth
        size="small"
        disabled
        sx={{ mb: 2 }}
        helperText="Change assignment from Fleet vehicles list."
      />
      <TextField
        label="Preferred update interval (sec)"
        value={form.updateIntervalSec}
        onChange={(e) => patch({ updateIntervalSec: e.target.value })}
        fullWidth
        size="small"
        type="number"
        disabled={!canSaveSpecs}
        helperText="Advisory — device protocol defines actual interval"
        sx={{ mb: 2 }}
      />
      {canSaveSpecs && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none' }}
            onClick={() => navigate('/fleet/vehicles')}
          >
            Fleet vehicles
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none' }}
            onClick={() => navigate(`/settings/device/${deviceId}`)}
          >
            Device settings
          </Button>
          <Button
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none' }}
            onClick={() => navigate(`/settings/maintenances`)}
          >
            Maintenance schedule
          </Button>
        </Box>
      )}
      {vehicleId && !canSaveSpecs && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Open Fleet vehicles to assign device ID {vehicleId ? '' : ''} to this vehicle.
        </Typography>
      )}
    </>
  );
}
