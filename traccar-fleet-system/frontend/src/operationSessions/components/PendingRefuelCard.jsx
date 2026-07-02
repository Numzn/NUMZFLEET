import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import DriverValue from '../../common/components/DriverValue';
import { fuelApiErrorMessage } from '../../fleet/vehiclesApi.js';
import { validateMileageAgainstPrevious } from '../utils/validateMileage.js';
import OperationVehicleLabel from './OperationVehicleLabel.jsx';
import FuelCaptureFields from './FuelCaptureFields.jsx';
import SkipReasonDialog from './SkipReasonDialog.jsx';

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
  sessionInProgress = false,
  onDone,
  onArrived,
  onSkip,
}) {
  const litresInputRef = useRef(null);
  const [litres, setLitres] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSource, setMileageSource] = useState(null);
  const [isFullTank, setIsFullTank] = useState(true);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [focusLitres, setFocusLitres] = useState(false);
  const [localError, setLocalError] = useState('');
  const arrived = refuel.arrivedAt != null;
  const hideArrivedStep = sessionInProgress && arrived;

  const planned = refuel.plannedFuelLitres != null
    ? Number(refuel.plannedFuelLitres)
    : (refuel.estimatedFuelLitres != null ? Number(refuel.estimatedFuelLitres) : null);
  const price = refuel.erbPricePerLitre != null ? Number(refuel.erbPricePerLitre) : null;
  const parsed = Number(litres);
  const parsedMileage = mileage !== '' ? Number(mileage) : null;
  const hasDraft = Number.isFinite(parsed) && parsed > 0;
  const mileageCheck = validateMileageAgainstPrevious(parsedMileage, previousMileage);
  const needsOverride = !mileageCheck.valid;
  const quickSubmit = hasDraft
    && planned != null
    && Math.abs(parsed - planned) < 0.05
    && !needsOverride;
  const fuelType = fuelTypeLabel(refuel.fuelTypeSnapshot);
  const driverId = device?.attributes?.driverUniqueId;

  useEffect(() => {
    if (litres !== '' || planned == null || !Number.isFinite(planned)) return;
    setLitres(String(planned));
  }, [litres, planned]);

  useEffect(() => {
    if (mileage !== '') return;
    if (refuel.odometerKm != null) {
      setMileage(String(refuel.odometerKm));
      setMileageSource('snapshot');
    }
  }, [mileage, refuel.odometerKm]);

  useEffect(() => {
    if (focusLitres) {
      litresInputRef.current?.focus();
      setFocusLitres(false);
    }
  }, [focusLitres]);

  const submitRefuel = async () => {
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
      setFocusLitres(true);
    } catch (e) {
      setLocalError(fuelApiErrorMessage(e, 'Failed to mark arrived'));
    } finally {
      setArriving(false);
    }
  };

  const handleSkipConfirm = async (reason) => {
    if (!onSkip) return;
    setLocalError('');
    setSkipping(true);
    try {
      await onSkip(refuel.id, reason);
      setSkipOpen(false);
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
            ) : onArrived && !hideArrivedStep ? (
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
                onClick={() => setSkipOpen(true)}
                disabled={disabled || skipping}
                sx={{ textTransform: 'none', py: 0.25, color: 'text.secondary' }}
              >
                Skip
              </Button>
            )}
          </Stack>
        </Box>

        <FuelCaptureFields
          litres={litres}
          onLitresChange={setLitres}
          mileage={mileage}
          onMileageChange={(value) => {
            setMileage(value);
            setMileageSource('manual');
          }}
          isFullTank={isFullTank}
          onFullTankChange={setIsFullTank}
          planned={planned}
          price={price}
          mileageCheck={mileageCheck}
          overrideReason={overrideReason}
          onOverrideReasonChange={setOverrideReason}
          disabled={disabled || saving}
          litresInputRef={litresInputRef}
          autoFocusLitres={focusLitres}
        />

        {refuel.odometerConfidence && refuel.odometerConfidence !== 'unavailable' && (
          <Chip size="small" label={`Odometer: ${refuel.odometerConfidence}`} variant="outlined" />
        )}

        {localError && <Alert severity="error" sx={{ py: 0 }}>{localError}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="small"
            onClick={submitRefuel}
            disabled={disabled || saving}
            sx={{ textTransform: 'none', minWidth: 88 }}
          >
            {saving ? 'Saving…' : (quickSubmit ? 'Confirm' : 'Done')}
          </Button>
        </Box>
      </Stack>

      <SkipReasonDialog
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        onConfirm={handleSkipConfirm}
        saving={skipping}
      />
    </Box>
  );
}
