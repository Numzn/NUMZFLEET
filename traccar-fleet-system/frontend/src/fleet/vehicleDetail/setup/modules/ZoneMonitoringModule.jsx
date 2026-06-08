import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
  const zoneProtectionActive = linkedCount > 0;

  if (!canSaveSpecs) {
    return (
      <Alert severity="info">
        Link a tracker to assign zones and configure geofence notifications.
      </Alert>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Status
        </Typography>
        {linkedGeofencesLoading ? (
          <Chip size="small" variant="outlined" label="Checking…" />
        ) : linkedGeofencesError ? (
          <Chip size="small" color="warning" variant="outlined" label="Could not verify" />
        ) : (
          <Chip
            size="small"
            color={zoneProtectionActive ? 'success' : 'default'}
            variant={zoneProtectionActive ? 'filled' : 'outlined'}
            label={zoneProtectionActive ? 'Active' : 'Not Configured'}
          />
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Linked zones
        </Typography>
        {linkedGeofencesLoading && (
          <Typography variant="body2" color="text.secondary">
            Checking zone assignments…
          </Typography>
        )}
        {!linkedGeofencesLoading && linkedGeofencesError && (
          <Typography variant="body2" color="warning.main">
            Could not verify zone assignments. Use Manage assignments to confirm.
          </Typography>
        )}
        {!linkedGeofencesLoading && !linkedGeofencesError && linkedCount === 0 && (
          <Typography variant="body2" color="text.secondary">
            No zones assigned to this device. Enter/exit events require at least one assigned zone
            and a real boundary crossing.
          </Typography>
        )}
        {!linkedGeofencesLoading && !linkedGeofencesError && linkedCount > 0 && (
          <Typography variant="body2" fontWeight={600}>
            {linkedCount} assigned zone{linkedCount === 1 ? '' : 's'}: {names.join(', ')}
          </Typography>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Notifications
        </Typography>
        <FormControlLabel
          control={(
            <Switch
              checked={form.alGeo}
              onChange={(e) => patch({ alGeo: e.target.checked })}
              disabled={!canSaveSpecs}
            />
          )}
          label="Geofence notifications"
          sx={{ display: 'block' }}
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4.5 }}>
          When enabled, managers receive alerts when a vehicle enters or exits assigned zones.
          Also controls visibility in this vehicle&apos;s workspace alert list. Events are still
          recorded by the platform.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button
          size="small"
          variant="outlined"
          sx={{ textTransform: 'none' }}
          onClick={() => navigate('/geofences')}
        >
          Manage zones
        </Button>
        <Button
          size="small"
          variant="outlined"
          sx={{ textTransform: 'none' }}
          onClick={() => navigate(`/settings/device/${deviceId}/connections`)}
        >
          Manage assignments
        </Button>
      </Box>

      <Button
        size="small"
        onClick={() => setAdvancedOpen((o) => !o)}
        sx={{ textTransform: 'none', mb: 1, px: 0 }}
      >
        {advancedOpen ? 'Hide advanced (legacy)' : 'Advanced (legacy)'}
      </Button>
      <Collapse in={advancedOpen}>
        <TextField
          label="Preferred zone radius (m) — advisory"
          value={form.geofenceRadiusM}
          onChange={(e) => patch({ geofenceRadiusM: e.target.value })}
          fullWidth
          size="small"
          type="number"
          helperText="Legacy advisory value. Does not create or resize zones."
        />
      </Collapse>
    </>
  );
}
