import { Alert, FormControlLabel, Switch, Typography } from '@mui/material';

export default function AlertsMonitoringModule({ form, patch, canSaveSpecs }) {
  return (
    <>
      {!canSaveSpecs && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Link a device to configure alert preferences.
        </Alert>
      )}
      <FormControlLabel
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
        control={(
          <Switch
            checked={form.alGeo}
            onChange={(e) => patch({ alGeo: e.target.checked })}
            disabled={!canSaveSpecs}
          />
        )}
        label="Geofence enter/exit in workspace alerts"
      />
      {canSaveSpecs && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: -0.5, mb: 1, ml: 4.5 }}>
          Hides zone enter/exit in this vehicle&apos;s workspace alert list. Events are still recorded by the platform.
        </Typography>
      )}
      <FormControlLabel
        control={(
          <Switch
            checked={form.alCut}
            onChange={(e) => patch({ alCut: e.target.checked })}
            disabled={!canSaveSpecs}
          />
        )}
        label="Engine cut notification"
      />
    </>
  );
}
