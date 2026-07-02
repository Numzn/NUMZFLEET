import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { fuelApiErrorMessage } from '../vehiclesApi.js';
import {
  completeMaintenanceService,
  isDistanceMaintenanceType,
  isHoursMaintenanceType,
  isTimeMaintenanceType,
} from './completeMaintenanceService.js';

function prefillEngineHours(item) {
  const ms = Number(item?.current);
  if (!Number.isFinite(ms)) return '';
  return String(Math.round((ms / 3600000) * 10) / 10);
}

function toDateInputValue(isoOrDate = new Date()) {
  return dayjs(isoOrDate).format('YYYY-MM-DD');
}

export default function CompleteMaintenanceDialog({
  open,
  maintenanceItem,
  fleetVehicleId,
  user,
  onClose,
  onCompleted,
  registryOdometerKm,
  routineServiceMode = false,
}) {
  const [completionDate, setCompletionDate] = useState(toDateInputValue());
  const [odometerKm, setOdometerKm] = useState('');
  const [engineHours, setEngineHours] = useState('');
  const [cost, setCost] = useState('');
  const [technician, setTechnician] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !maintenanceItem) return;
    const fromEngine = registryOdometerKm != null && Number.isFinite(Number(registryOdometerKm))
      ? String(Math.round(Number(registryOdometerKm)))
      : '';
    setCompletionDate(toDateInputValue());
    setOdometerKm(fromEngine);
    setEngineHours(prefillEngineHours(maintenanceItem));
    setCost('');
    setTechnician('');
    setNotes('');
    setError(null);
  }, [open, maintenanceItem, registryOdometerKm]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!maintenanceItem || !fleetVehicleId) return;
    setSaving(true);
    setError(null);
    try {
      await completeMaintenanceService(user, fleetVehicleId, maintenanceItem, {
        odometerKm,
        cost: routineServiceMode ? undefined : cost,
        vendor: technician,
        technician,
        notes,
        completedAt: completionDate ? dayjs(completionDate).toISOString() : undefined,
      });
      onClose();
      await onCompleted?.();
    } catch (e) {
      setError(fuelApiErrorMessage(e, e?.partialSuccess ? e.message : 'Failed to complete service'));
      if (e?.partialSuccess) {
        await onCompleted?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!maintenanceItem) return null;

  const isTime = isTimeMaintenanceType(maintenanceItem.type);
  const isHours = isHoursMaintenanceType(maintenanceItem.type);
  const isDistance = isDistanceMaintenanceType(maintenanceItem.type);
  const blocked = maintenanceItem.unknown
    && !(routineServiceMode && odometerKm !== '' && odometerKm != null);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{routineServiceMode ? 'Complete Routine Service' : 'Complete service'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {!routineServiceMode ? (
          <TextField
            label="Service type"
            value={maintenanceItem.name || ''}
            InputProps={{ readOnly: true }}
            fullWidth
          />
        ) : null}

        <TextField
          label="Completion date"
          type="date"
          value={completionDate}
          onChange={(e) => setCompletionDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
          autoFocus={routineServiceMode}
        />

        {isTime && !routineServiceMode ? (
          <TextField
            label="Completion date"
            value={dayjs().format('MMM D, YYYY')}
            InputProps={{ readOnly: true }}
            fullWidth
          />
        ) : null}

        {isDistance ? (
          <TextField
            label="Completion odometer (km)"
            type="number"
            value={odometerKm}
            onChange={(e) => setOdometerKm(e.target.value)}
            inputProps={{ min: 0 }}
            fullWidth
            autoFocus={!routineServiceMode}
          />
        ) : null}

        {isHours ? (
          <TextField
            label="Engine hours"
            type="number"
            value={engineHours}
            InputProps={{ readOnly: true }}
            inputProps={{ min: 0, step: 0.1 }}
            fullWidth
          />
        ) : null}

        <TextField
          label={routineServiceMode ? 'Technician' : 'Garage / vendor'}
          value={technician}
          onChange={(e) => setTechnician(e.target.value)}
          fullWidth
        />
        {!routineServiceMode ? (
          <TextField
            label="Cost"
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            fullWidth
          />
        ) : null}
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          fullWidth
        />

        {blocked ? (
          <Typography variant="body2" color="text.secondary">
            Waiting for live telemetry before this schedule can be completed.
          </Typography>
        ) : null}

        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving || blocked}>
          {routineServiceMode ? 'Complete Service' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
