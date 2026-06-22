import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { fuelApiErrorMessage } from '../../fleet/vehiclesApi.js';
import { unlockOperation } from '../api/operationSessionsApi.js';

const DURATION_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
];

/**
 * Manager-only dialog to grant a temporary edit window on a locked operation.
 */
export default function UnlockDialog({
  open, onClose, onUnlocked, operationId,
}) {
  const user = useSelector((state) => state.session.user);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('A reason is required to unlock.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await unlockOperation(user, operationId, { durationMinutes, reason: reason.trim() });
      onUnlocked?.();
    } catch (err) {
      setError(fuelApiErrorMessage(err, 'Failed to unlock operation'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Unlock operation</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1.5, fontSize: '0.85rem' }}>
          Grants a temporary edit window so recording can be corrected after lock.
          The action is logged.
        </DialogContentText>
        <Stack spacing={1.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Unlock for"
            size="small"
            fullWidth
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          >
            {DURATION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Reason"
            size="small"
            fullWidth
            multiline
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" color="warning" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Unlocking…' : 'Unlock'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
