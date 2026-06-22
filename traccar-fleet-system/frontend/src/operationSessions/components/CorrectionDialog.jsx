import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { fuelApiErrorMessage } from '../../fleet/vehiclesApi.js';
import { createOperationAdjustment } from '../api/operationSessionsApi.js';

const FIELD_OPTIONS = [
  { value: 'actualFuelLitres', label: 'Actual litres' },
  { value: 'currentMileage', label: 'Mileage' },
  { value: 'actualCost', label: 'Actual cost' },
];

export default function CorrectionDialog({
  open,
  onClose,
  onSubmitted,
  operationId,
  refuel,
}) {
  const user = useSelector((state) => state.session.user);
  const [field, setField] = useState('actualFuelLitres');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newValue.trim() || !reason.trim()) {
      setError('New value and reason are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await createOperationAdjustment(user, operationId, {
        refuelId: refuel.id,
        field,
        newValue,
        reason,
      });
      onSubmitted?.();
    } catch (err) {
      setError(fuelApiErrorMessage(err, 'Failed to submit correction'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Report correction</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Field"
            size="small"
            fullWidth
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            {FIELD_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Corrected value"
            size="small"
            fullWidth
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
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
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
