import { Alert, Box, FormControlLabel, Switch, Typography } from '@mui/material';

export default function AlertsMonitoringModule({ form, patch, canSaveSpecs }) {
  return (
    <Box>
      {!canSaveSpecs && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Link a device to configure alert preferences.
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Geofence enter/exit notifications are configured under{' '}
        <strong>Zones &amp; Boundaries</strong> below.
      </Typography>
      <FormControlLabel
        sx={{ display: 'flex', mb: 0.5 }}
        control={(
          <Switch
            checked={form.alLow}
            onChange={(e) => patch({ alLow: e.target.checked })}
            disabled={!canSaveSpecs}
          />
        )}
        label="Low fuel"
      />
      <FormControlLabel
        sx={{ display: 'flex', mb: 0.5 }}
        control={(
          <Switch
            checked={form.alSpeed}
            onChange={(e) => patch({ alSpeed: e.target.checked })}
            disabled={!canSaveSpecs}
          />
        )}
        label="Speeding"
      />
      <FormControlLabel
        sx={{ display: 'flex' }}
        control={(
          <Switch
            checked={form.alCut}
            onChange={(e) => patch({ alCut: e.target.checked })}
            disabled={!canSaveSpecs}
          />
        )}
        label="Engine cut notification"
      />
    </Box>
  );
}
