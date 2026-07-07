import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Divider, Stack, TextField, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { fuelApiErrorMessage } from '../../fleet/vehiclesApi.js';
import { validateMileageAgainstPrevious } from '../utils/validateMileage.js';
import { useOperationVehicleDisplay } from './OperationVehicleLabel.jsx';
import FuelCaptureFields from './FuelCaptureFields.jsx';
import SkipReasonDialog from './SkipReasonDialog.jsx';
import { formatLitres, tankLabel } from '../utils/formatters.js';

/** Deep, theme-aware fuel-type colors. Unknown/unavailable fuel types render neutral. */
function fuelTypeColor(fuelType, mode) {
  const key = String(fuelType || '').trim().toLowerCase();
  if (key === 'petrol') return mode === 'dark' ? '#4ADE80' : '#15803D';
  if (key === 'diesel') return mode === 'dark' ? '#C084FC' : '#7E22CE';
  return null;
}

export default function PendingRefuelCard({
  refuel,
  capacityL,
  capacitySource,
  disabled,
  previousMileage,
  sessionInProgress = false,
  expanded = false,
  onToggleExpand,
  onDone,
  onArrived,
  onSkip,
}) {
  const litresInputRef = useRef(null);
  const [litres, setLitres] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageSource, setMileageSource] = useState(null);
  const [mileageEditing, setMileageEditing] = useState(false);
  // No shadow Fuel State evidence is wired to this screen (see fuelFillClassification
  // suggestion notes) — the only truthful default is UNKNOWN ("Not sure"). Operator can
  // change it via the Tank state "Change" control; this is never silently upgraded.
  const [fillClassification, setFillClassification] = useState('UNKNOWN');
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [focusLitres, setFocusLitres] = useState(false);
  const [localError, setLocalError] = useState('');
  const display = useOperationVehicleDisplay(refuel.vehicleId);
  const theme = useTheme();
  const arrived = refuel.arrivedAt != null;
  const hideArrivedStep = sessionInProgress && arrived;

  const planned = refuel.plannedFuelLitres != null
    ? Number(refuel.plannedFuelLitres)
    : (refuel.estimatedFuelLitres != null ? Number(refuel.estimatedFuelLitres) : null);
  const parsed = Number(litres);
  const parsedMileage = mileage !== '' ? Number(mileage) : null;
  const hasDraft = Number.isFinite(parsed) && parsed > 0;
  const mileageCheck = validateMileageAgainstPrevious(parsedMileage, previousMileage);
  const needsOverride = !mileageCheck.valid;
  const capacityLabel = tankLabel(capacityL, capacitySource);
  const fuelTypeText = refuel.fuelTypeSnapshot ? String(refuel.fuelTypeSnapshot).toUpperCase() : null;
  const fuelColor = fuelTypeColor(refuel.fuelTypeSnapshot, theme.palette.mode);

  // Mileage is Odometer Engine evidence, not a manual entry point — prefill from the
  // canonical value and only mark it 'manual' if the operator explicitly overrides it.
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
        fillClassification,
        overrideReason: needsOverride ? overrideReason.trim() : undefined,
      });
      setLitres('');
      setFillClassification('UNKNOWN');
      setOverrideReason('');
    } catch (e) {
      setLocalError(fuelApiErrorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleArrived = async (e) => {
    e.stopPropagation();
    if (!onArrived) return;
    setLocalError('');
    setArriving(true);
    try {
      await onArrived(refuel.id);
      setFocusLitres(true);
    } catch (err) {
      setLocalError(fuelApiErrorMessage(err, 'Failed to mark arrived'));
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
    <Box>
      <Box
        role="button"
        tabIndex={0}
        onClick={() => !disabled && onToggleExpand?.(refuel.id)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pt: 1.25,
          pb: fuelTypeText ? 0.25 : 1.25,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>{display.primary}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {display.secondary || '—'}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          {capacityLabel && (
            <Typography variant="caption" color="text.secondary" display="block">
              {capacityLabel}
            </Typography>
          )}
        </Box>
        {!expanded && (
          <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
        )}
      </Box>

      {fuelTypeText && (
        <Box sx={{ textAlign: 'center', lineHeight: 1.2, pb: 0.25 }}>
          <Typography
            component="span"
            sx={{
              fontSize: '0.8rem',
              fontWeight: 900,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: fuelColor || 'text.secondary',
            }}
          >
            {fuelTypeText}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: expanded ? 1 : 0.75 }}>
        <Typography variant="body2" fontWeight={700} sx={{ flex: 1, textAlign: 'left' }}>
          {planned != null && Number.isFinite(planned) ? `Planned ${formatLitres(planned)}` : 'Planned —'}
        </Typography>
        <Box sx={{ flex: 1, textAlign: 'right' }}>
          <Typography variant="body2" fontWeight={700}>
            {refuel.odometerKm != null ? `${Number(refuel.odometerKm).toLocaleString()} km` : '—'}
          </Typography>
          {expanded ? (
            <Typography
              component="button"
              type="button"
              onClick={(e) => { e.stopPropagation(); setMileageEditing((v) => !v); }}
              variant="caption"
              sx={{
                border: 0, background: 'none', p: 0, color: 'primary.main', cursor: 'pointer',
              }}
            >
              Mileage
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">Mileage</Typography>
          )}
        </Box>
      </Box>

      {expanded && (
        <Stack spacing={1.25} sx={{ pb: 1.25 }}>
          {!arrived && onArrived && !hideArrivedStep && (
            <Button
              size="small"
              onClick={handleArrived}
              disabled={disabled || arriving}
              sx={{ textTransform: 'none', px: 0, alignSelf: 'flex-start' }}
            >
              {arriving ? 'Marking…' : 'Mark arrived'}
            </Button>
          )}

          {mileageEditing && (
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
              inputProps={{ min: 0, step: 1 }}
              helperText={needsOverride ? mileageCheck.message : undefined}
              error={Boolean(needsOverride && !overrideReason.trim())}
            />
          )}
          {needsOverride && (
            <TextField
              label="Override reason"
              size="small"
              fullWidth
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              disabled={disabled || saving}
            />
          )}

          <FuelCaptureFields
            litres={litres}
            onLitresChange={setLitres}
            planned={planned}
            fillClassification={fillClassification}
            onFillClassificationChange={setFillClassification}
            disabled={disabled || saving}
            litresInputRef={litresInputRef}
            autoFocusLitres={focusLitres}
          />

          {localError && <Alert severity="error" sx={{ py: 0 }}>{localError}</Alert>}

          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={(e) => { e.stopPropagation(); submitRefuel(); }}
            disabled={disabled || saving}
            sx={{ textTransform: 'none', fontWeight: 700, py: 1.25 }}
          >
            {saving ? 'Saving…' : 'Confirm Fueling'}
          </Button>

          {onSkip && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                size="small"
                color="error"
                onClick={(e) => { e.stopPropagation(); setSkipOpen(true); }}
                disabled={disabled || skipping}
                sx={{ textTransform: 'none', fontWeight: 400 }}
              >
                Skip vehicle
              </Button>
            </Box>
          )}
        </Stack>
      )}

      <Divider />

      <SkipReasonDialog
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        onConfirm={handleSkipConfirm}
        saving={skipping}
      />
    </Box>
  );
}
