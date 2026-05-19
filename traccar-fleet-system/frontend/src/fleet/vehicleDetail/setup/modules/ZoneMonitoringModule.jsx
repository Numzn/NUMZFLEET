import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

function linkedZoneNames(linkedGeofences) {
  return (linkedGeofences || [])
    .map((g) => g?.name?.trim())
    .filter(Boolean);
}

export default function ZoneMonitoringModule({
  form,
  patch,
  canSaveSpecs,
  deviceId,
  linkedGeofences,
  linkedGeofencesLoading,
  linkedGeofencesError,
}) {
  const navigate = useNavigate();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const names = linkedZoneNames(linkedGeofences);
  const linkedCount = names.length;

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Geofence areas and device links are managed in Traccar. NUMZFLEET configures how this
        vehicle operationally interacts with linked zones.
      </Alert>

      {!canSaveSpecs && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Link a tracker to configure zone monitoring preferences.
        </Alert>
      )}

      <FormControlLabel
        control={(
          <Switch
            checked={form.geofenceEnabled}
            onChange={(e) => patch({ geofenceEnabled: e.target.checked })}
            disabled={!canSaveSpecs}
          />
        )}
        label="Monitor linked zones"
        sx={{ mb: 2, display: 'block' }}
      />

      {canSaveSpecs && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Linked operational zones (Traccar)
          </Typography>
          {linkedGeofencesLoading && (
            <Typography variant="body2" color="text.secondary">
              Checking zone links…
            </Typography>
          )}
          {!linkedGeofencesLoading && linkedGeofencesError && (
            <Typography variant="body2" color="warning.main">
              Could not verify zone links. Use Traccar to manage connections.
            </Typography>
          )}
          {!linkedGeofencesLoading && !linkedGeofencesError && linkedCount === 0 && (
            <Typography variant="body2" color="text.secondary">
              No zones linked to this device yet.
            </Typography>
          )}
          {!linkedGeofencesLoading && !linkedGeofencesError && linkedCount > 0 && (
            <Typography variant="body2" fontWeight={600}>
              {names.join(', ')}
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none', mt: 1.5 }}
            onClick={() => navigate(`/settings/device/${deviceId}/connections`)}
          >
            Manage zones in Traccar
          </Button>
        </Box>
      )}

      {canSaveSpecs && (
        <>
          <Button
            size="small"
            onClick={() => setAdvancedOpen((o) => !o)}
            sx={{ textTransform: 'none', mb: 1, px: 0 }}
          >
            {advancedOpen ? 'Hide advanced' : 'Advanced'}
          </Button>
          <Collapse in={advancedOpen}>
            <TextField
              label="Preferred zone radius (m) — advisory"
              value={form.geofenceRadiusM}
              onChange={(e) => patch({ geofenceRadiusM: e.target.value })}
              fullWidth
              size="small"
              type="number"
              disabled={!form.geofenceEnabled}
              helperText="Does not create or resize zones in Traccar. For future operational hints only."
            />
          </Collapse>
        </>
      )}
    </>
  );
}
