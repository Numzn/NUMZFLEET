import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { distanceFromMeters } from '../../common/util/converter';
import { createAndLinkMaintenanceSchedule, SCHEDULE_PRESETS } from '../maintenanceScheduleApi';

function defaultLastServiceKm(currentOdometerMeters) {
  const km = distanceFromMeters(Number(currentOdometerMeters) || 0, 'km');
  return Number.isFinite(km) && km > 0 ? Math.round(km) : '';
}

export default function AddMaintenanceScheduleDialog({
  open,
  onClose,
  deviceId,
  currentOdometerMeters,
  onCreated,
}) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('km');
  const [interval, setInterval] = useState('10000');
  const [lastServiceKm, setLastServiceKm] = useState('');
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const suggestedLastKm = useMemo(
    () => defaultLastServiceKm(currentOdometerMeters),
    [currentOdometerMeters],
  );

  useEffect(() => {
    if (!open) return;
    setName('');
    setMode('km');
    setInterval('10000');
    setLastServiceKm(suggestedLastKm !== '' ? String(suggestedLastKm) : '');
    setLastServiceDate(new Date().toISOString().slice(0, 10));
    setError(null);
    setSaving(false);
  }, [open, suggestedLastKm]);

  const applyPreset = (preset) => {
    setName(preset.name);
    setMode(preset.mode);
    setInterval(String(preset.interval));
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await createAndLinkMaintenanceSchedule(deviceId, {
        name,
        mode,
        interval,
        lastServiceAt: mode === 'days' ? lastServiceDate : lastServiceKm,
      });
      await onCreated?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to add service schedule');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = Boolean(
    deviceId
    && name.trim()
    && Number(interval) > 0
    && (mode === 'days' ? lastServiceDate : lastServiceKm !== '' && Number(lastServiceKm) >= 0),
  );

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add service schedule</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sets up recurring reminders for this vehicle and powers
          {' '}
          <strong>Next Service Due In</strong>
          {' '}
            on the vehicle card.
        </Typography>

        {!deviceId ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Assign a tracker to this vehicle first.
          </Alert>
        ) : null}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
          {SCHEDULE_PRESETS.map((preset) => (
            <Chip
              key={preset.key}
              label={preset.label}
              size="small"
              variant="outlined"
              onClick={() => applyPreset(preset)}
            />
          ))}
        </Box>

        <TextField
          label="Service name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          required
          sx={{ mb: 2 }}
          placeholder="e.g. Oil change"
        />

        <TextField
          select
          label="Repeat by"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        >
          <MenuItem value="km">Kilometers (odometer)</MenuItem>
          <MenuItem value="days">Days (calendar)</MenuItem>
        </TextField>

        <TextField
          label={mode === 'days' ? 'Every (days)' : 'Every (km)'}
          type="number"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          fullWidth
          size="small"
          required
          inputProps={{ min: 1 }}
          sx={{ mb: 2 }}
        />

        {mode === 'km' ? (
          <TextField
            label="Odometer at last service (km)"
            type="number"
            value={lastServiceKm}
            onChange={(e) => setLastServiceKm(e.target.value)}
            fullWidth
            size="small"
            required
            inputProps={{ min: 0 }}
            helperText={
              suggestedLastKm !== ''
                ? `Current odometer ≈ ${Number(suggestedLastKm).toLocaleString()} km`
                : 'Enter the reading when this service was last done'
            }
          />
        ) : (
          <TextField
            label="Last service date"
            type="date"
            value={lastServiceDate}
            onChange={(e) => setLastServiceDate(e.target.value)}
            fullWidth
            size="small"
            required
            InputLabelProps={{ shrink: true }}
          />
        )}

        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? 'Saving…' : 'Add schedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
