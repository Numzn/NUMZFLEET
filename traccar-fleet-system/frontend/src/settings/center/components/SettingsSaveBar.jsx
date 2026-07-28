import { Box, Button, Alert } from '@mui/material';

/**
 * Ported from the dirty-state sticky bar in fleet/vehicleDetail/VehicleSetupPage.jsx
 * (sticky on mobile only, "Unsaved changes" warning, Save disabled until dirty) —
 * without that page's window.confirm leave-guard, which the audit flagged as a
 * pattern not worth copying verbatim.
 */
export default function SettingsSaveBar({
  dirty, saving, onSave, onCancel, error,
}) {
  if (!dirty && !error) return null;
  return (
    <Box
      sx={{
        position: { xs: 'sticky', sm: 'static' },
        bottom: { xs: 8, sm: 'auto' },
        bgcolor: { xs: 'background.paper', sm: 'transparent' },
        zIndex: 1,
        pt: 1.5,
        mt: 1,
      }}
    >
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {dirty && !error && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>Unsaved changes</Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant="outlined" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant={dirty ? 'contained' : 'outlined'}
          color={dirty ? 'primary' : 'inherit'}
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}
