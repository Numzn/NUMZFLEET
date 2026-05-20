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
  preferencesLoading = false,
}) {
  const navigate = useNavigate();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const names = linkedZoneNames(linkedGeofences);
  const linkedCount = names.length;

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Zone boundaries and device links are managed under device connections. NUMZFLEET
        stores how this vehicle operationally uses linked zones. Changes apply after Review
        setup → Save setup.
      </Alert>

      {!canSaveSpecs && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Link a tracker to configure zone monitoring preferences.
        </Alert>
      )}

      {preferencesLoading ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Loading preferences…
        </Typography>
      ) : (
        <>
          <FormControlLabel
            control={(
              <Switch
                checked={form.geofenceEnabled}
                onChange={(e) => patch({ geofenceEnabled: e.target.checked })}
                disabled={!canSaveSpecs}
              />
            )}
            label="Monitor linked zones"
            sx={{ mb: 1, display: 'block' }}
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2, ml: 4.5 }}>
            Setup readiness only — does not create zones or generate enter/exit events.
            Use Alerts module to control workspace visibility of zone events.
          </Typography>
        </>
      )}

      {canSaveSpecs && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Linked operational zones
          </Typography>
          {linkedGeofencesLoading && (
            <Typography variant="body2" color="text.secondary">
              Checking zone links…
            </Typography>
          )}
          {!linkedGeofencesLoading && linkedGeofencesError && (
            <Typography variant="body2" color="warning.main">
              Could not verify zone links. Manage connections from device settings.
            </Typography>
          )}
          {!linkedGeofencesLoading && !linkedGeofencesError && linkedCount === 0 && (
            <>
              <Typography variant="body2" color="text.secondary">
                No zones linked to this device yet.
              </Typography>
              <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5 }}>
                Enter/exit events require at least one linked zone and a real boundary crossing.
              </Typography>
            </>
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
            Manage zone connections
          </Button>
        </Box>
      )}

      {canSaveSpecs && !preferencesLoading && (
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
              helperText="Does not create or resize zones. For future operational hints only."
            />
          </Collapse>
        </>
      )}
    </>
  );
}
