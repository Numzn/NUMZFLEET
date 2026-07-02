import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Checkbox,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DriverValue from '../../common/components/DriverValue';
import { fuelApiErrorMessage } from '../../fleet/vehiclesApi.js';
import { formatZmw, formatZmwPerLitre } from '../utils/formatters.js';
import { validateMileageAgainstPrevious } from '../utils/validateMileage.js';
import { varianceTone } from '../utils/operationDayUtils.js';
import OperationVehicleLabel from './OperationVehicleLabel.jsx';

const fuelTypeLabel = (value) => {
  if (!value) return null;
  const s = String(value);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function PendingRefuelCard({
  refuel,
  device,
  disabled,
  previousMileage,
  onDone,
  onArrived,
  onSkip,
}) {
  const [litres, setLitres] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSource, setMileageSource] = useState(null);
  const [isFullTank, setIsFullTank] = useState(true);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [localError, setLocalError] = useState('');
  const arrived = refuel.arrivedAt != null;

  useEffect(() => {
    if (mileage !== '') return;
    if (refuel.odometerKm != null) {
      setMileage(String(refuel.odometerKm));
      setMileageSource('snapshot');
    }
  }, [mileage, refuel.odometerKm]);

  const planned = refuel.plannedFuelLitres != null
    ? Number(refuel.plannedFuelLitres)
    : (refuel.estimatedFuelLitres != null ? Number(refuel.estimatedFuelLitres) : null);
  const price = refuel.erbPricePerLitre != null ? Number(refuel.erbPricePerLitre) : null;
  const parsed = Number(litres);
  const parsedMileage = mileage !== '' ? Number(mileage) : null;
  const hasDraft = Number.isFinite(parsed) && parsed > 0;
  const diff = hasDraft && planned != null && Number.isFinite(planned) ? parsed - planned : null;
  const estCost = hasDraft && price != null ? parsed * price : null;
  const mileageCheck = validateMileageAgainstPrevious(parsedMileage, previousMileage);
  const needsOverride = !mileageCheck.valid;
  const fuelType = fuelTypeLabel(refuel.fuelTypeSnapshot);

  const driverId = device?.attributes?.driverUniqueId;

  const handleDone = async () => {
    if (!hasDraft) {
      setLocalError('Enter litres dispensed.');
      return;
    }
    if (needsOverride && !overrideReason.trim()) {
      setLocalError(mileageCheck.message);
      return;
    }
    setLocalError('');
    setSaving(true);
    try {
      await onDone({
        refuelId: refuel.id,
        actualFuelLitres: parsed,
        mileage: parsedMileage,
        mileageSource: mileageSource || 'manual',
        isFullTank,
        overrideReason: needsOverride ? overrideReason.trim() : undefined,
      });
      setLitres('');
      setOverrideReason('');
    } catch (e) {
      setLocalError(fuelApiErrorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleArrived = async () => {
    if (!onArrived) return;
    setLocalError('');
    setArriving(true);
    try {
      await onArrived(refuel.id);
    } catch (e) {
      setLocalError(fuelApiErrorMessage(e, 'Failed to mark arrived'));
    } finally {
      setArriving(false);
    }
  };

  const handleSkip = async () => {
    if (!onSkip) return;
    const reason = window.prompt('Reason for skipping this vehicle (optional):') ?? undefined;
    setLocalError('');
    setSkipping(true);
    try {
      await onSkip(refuel.id, reason ? reason.trim() : undefined);
    } catch (e) {
      setLocalError(fuelApiErrorMessage(e, 'Failed to skip vehicle'));
    } finally {
      setSkipping(false);
    }
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        p: 1.5,
        bgcolor: 'var(--surface-card)',
      }}
    >
      <Stack spacing={1.25}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <OperationVehicleLabel deviceId={refuel.vehicleId} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Driver:
              {' '}
              {driverId ? <DriverValue driverUniqueId={driverId} /> : '—'}
              {' · '}
              Planned:
              {' '}
              <strong>{planned != null && Number.isFinite(planned) ? `${planned} L` : '—'}</strong>
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
            {fuelType && (
              <Typography variant="caption" color="text.secondary">{fuelType}</Typography>
            )}
            {arrived ? (
              <Chip size="small" label="Arrived" color="info" variant="outlined" />
            ) : onArrived ? (
              <Button
                size="small"
                variant="outlined"
                onClick={handleArrived}
                disabled={disabled || arriving}
                sx={{ textTransform: 'none', py: 0.25 }}
              >
                {arriving ? 'Marking…' : 'Mark arrived'}
              </Button>
            ) : null}
            {onSkip && (
              <Button
                size="small"
                color="inherit"
                onClick={handleSkip}
                disabled={disabled || skipping}
                sx={{ textTransform: 'none', py: 0.25, color: 'text.secondary' }}
              >
                {skipping ? 'Skipping…' : 'Skip'}
              </Button>
            )}
          </Stack>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField
            label="Actual litres"
            type="number"
            size="small"
            fullWidth
            value={litres}
            onChange={(e) => setLitres(e.target.value)}
            disabled={disabled || saving}
            inputProps={{ min: 0.01, step: 0.1 }}
          />
          <TextField
            label="Mileage (km)"
            type="number"
            size="small"
            fullWidth
            value={mileage}
            onChange={(e) => {
              setMileage(e.target.value);
              setMileageSource('manual');
            }}
            disabled={disabled || saving}
            helperText={mileageSource ? `Source: ${mileageSource}` : ' '}
            FormHelperTextProps={{ sx: { mx: 0 } }}
          />
        </Stack>

        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1}>
          {refuel.odometerConfidence && refuel.odometerConfidence !== 'unavailable' && (
            <Chip
              size="small"
              label={`Odometer: ${refuel.odometerConfidence}`}
              variant="outlined"
            />
          )}
          <FormControlLabel
            control={(
              <Checkbox
                size="small"
                checked={isFullTank}
                onChange={(e) => setIsFullTank(e.target.checked)}
                disabled={disabled || saving}
              />
            )}
            label="Full tank"
          />
        </Stack>

        {needsOverride && (
          <TextField
            label="Override reason"
            fullWidth
            size="small"
            multiline
            minRows={2}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            disabled={disabled || saving}
          />
        )}

        {(hasDraft && diff != null) || (hasDraft && estCost != null) ? (
          <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
            {hasDraft && diff != null && (
              <Typography variant="body2" component="span">
                Difference:
                {' '}
                <Chip
                  size="small"
                  label={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} L`}
                  color={varianceTone(planned, parsed)}
                />
              </Typography>
            )}
            {hasDraft && estCost != null && (
              <Typography variant="body2" color="text.secondary">
                Est.
                {' '}
                {formatZmw(estCost)}
                {' '}
                @
                {' '}
                {formatZmwPerLitre(price)}
              </Typography>
            )}
          </Stack>
        ) : null}

        {localError && <Alert severity="error" sx={{ py: 0 }}>{localError}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="small"
            onClick={handleDone}
            disabled={disabled || saving}
            sx={{ textTransform: 'none', minWidth: 88 }}
          >
            {saving ? 'Saving…' : 'Done'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
