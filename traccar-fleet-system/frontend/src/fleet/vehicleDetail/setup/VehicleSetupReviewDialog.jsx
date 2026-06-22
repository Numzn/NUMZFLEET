import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { SETUP_MODULES } from './vehicleSetupModules.js';

function StatusIcon({ status }) {
  if (status === 'complete') return <CheckCircleIcon color="success" fontSize="small" />;
  if (status === 'blocked') return <LockIcon color="disabled" fontSize="small" />;
  if (status === 'optional') return <RadioButtonUncheckedIcon color="disabled" fontSize="small" />;
  return <WarningAmberIcon color="warning" fontSize="small" />;
}

export default function VehicleSetupReviewDialog({
  open,
  onClose,
  readiness,
  onSave,
  saving,
  saveError,
}) {
  const moduleById = Object.fromEntries(readiness.modules.map((m) => [m.id, m]));
  const { blockingIncomplete, attentionCount } = readiness;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Vehicle setup review</DialogTitle>
      <DialogContent>
        {blockingIncomplete && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Required modules are still incomplete (name and device link). You can save partial
            changes now, but this vehicle will not be ready for operations until those are done.
          </Alert>
        )}
        {!blockingIncomplete && attentionCount > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Required setup is complete. Recommended items below can be finished later.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review setup before saving. Recommended items can be completed later.
        </Typography>
        <List dense disablePadding>
          {SETUP_MODULES.map((mod) => {
            const row = moduleById[mod.id];
            if (!row) return null;
            return (
              <ListItem key={mod.id} disableGutters sx={{ py: 0.75 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <StatusIcon status={row.status} />
                </ListItemIcon>
                <ListItemText
                  primary={mod.title}
                  secondary={row.label}
                  primaryTypographyProps={{ fontWeight: 600, variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            );
          })}
        </List>
        {saveError && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            {saveError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          Back to edit
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save setup'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
