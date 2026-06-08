import { Alert, FormControlLabel, Switch } from '@mui/material';

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
