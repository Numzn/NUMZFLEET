import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

const statusColor = (status) => {
  if (status === 'flagged') return 'error';
  if (status === 'warning' || status === 'incomplete') return 'warning';
  return 'success';
};

const RefuelCard = ({ refuel, onSubmit, disabled = false }) => {
  const [actualFuelLitres, setActualFuelLitres] = useState(
    refuel.actualFuelLitres != null && refuel.actualFuelLitres !== '' ? String(refuel.actualFuelLitres) : '',
  );
  const [pumpStart, setPumpStart] = useState('');
  const [pumpEnd, setPumpEnd] = useState('');
  const [mileage, setMileage] = useState(refuel.currentMileage != null ? String(refuel.currentMileage) : '');
  const [tankCap, setTankCap] = useState('');
  const [tankLevelPct, setTankLevelPct] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActualFuelLitres(
      refuel.actualFuelLitres != null && refuel.actualFuelLitres !== '' ? String(refuel.actualFuelLitres) : '',
    );
    setMileage(refuel.currentMileage != null ? String(refuel.currentMileage) : '');
    setTankCap(
      refuel.tankCapacitySnapshot != null && Number.isFinite(Number(refuel.tankCapacitySnapshot))
        ? String(refuel.tankCapacitySnapshot)
        : '',
    );
    setTankLevelPct(
      refuel.tankLevelStart != null && Number.isFinite(Number(refuel.tankLevelStart))
        ? String(Math.round(Number(refuel.tankLevelStart) * 100))
        : '',
    );
  }, [refuel.id, refuel.actualFuelLitres, refuel.currentMileage, refuel.tankCapacitySnapshot, refuel.tankLevelStart]);

  const handleSubmit = async () => {
    const parsed = Number(actualFuelLitres);
    const ps = pumpStart === '' ? NaN : Number(pumpStart);
    const pe = pumpEnd === '' ? NaN : Number(pumpEnd);
    const hasPump = Number.isFinite(ps) && Number.isFinite(pe);
    const hasLitres = Number.isFinite(parsed) && parsed > 0;

    const payload = { refuelId: refuel.id };
    if (mileage !== '') {
      payload.mileage = Number(mileage);
    }
    if (tankCap !== '') {
      payload.tankCapacitySnapshot = Number(tankCap);
    }
    if (tankLevelPct !== '') {
      payload.tankLevelStart = Number(tankLevelPct) / 100;
    }

    if (hasPump && pe <= ps) {
      setError('Pump end must be greater than pump start.');
      return;
    }

    const hasMeta =
      payload.tankCapacitySnapshot !== undefined
      || payload.tankLevelStart !== undefined
      || payload.mileage !== undefined;

    if (!hasPump && !hasLitres) {
      if (!hasMeta) {
        setError('Enter vehicle tank data to save, or enter actual litres / pump readings.');
        return;
      }
    }

    if (hasPump) {
      payload.pumpStart = ps;
      payload.pumpEnd = pe;
    } else if (hasLitres) {
      payload.actualFuelLitres = parsed;
    }

    setError('');
    setSaving(true);
    try {
      await onSubmit?.(payload);
      if (hasPump) {
        setPumpStart('');
        setPumpEnd('');
      }
    } catch (submitError) {
      setError(submitError.message || 'Failed to update refuel');
    } finally {
      setSaving(false);
    }
  };

  const showVariance =
    refuel.actualFuelLitres != null
    && (refuel.varianceLitres != null || refuel.variancePercent != null);

  const isIncomplete = refuel.status === 'incomplete';

  return (
    <Card variant="outlined" sx={isIncomplete ? { borderColor: 'warning.main', boxShadow: 1 } : undefined}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1">Vehicle #{refuel.vehicleId}</Typography>
            <Chip size="small" label={refuel.status || 'normal'} color={statusColor(refuel.status)} />
          </Box>

          {isIncomplete && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              Missing tank capacity and/or fuel level — estimates may be blank. Update vehicle data below or enter
              dispense readings.
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            Mileage: {refuel.currentMileage ?? 'n/a'} | Tank level:{' '}
            {refuel.tankLevelStart != null ? `${Math.round(Number(refuel.tankLevelStart) * 100)}%` : 'n/a'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Estimated: {refuel.estimatedFuelLitres ?? '—'} L | ERB: {refuel.erbPricePerLitre ?? 'n/a'} ZMW/L
          </Typography>

          {showVariance && (
            <Typography variant="body2" color="text.secondary">
              Variance: {refuel.varianceLitres != null ? `${refuel.varianceLitres} L` : '—'}
              {refuel.variancePercent != null ? ` (${refuel.variancePercent}% vs estimate)` : ''}
            </Typography>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="subtitle2" color="text.secondary">
            Vehicle data (fixes incomplete rows)
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Tank capacity (L)"
              value={tankCap}
              onChange={(e) => setTankCap(e.target.value)}
              size="small"
              fullWidth
              type="number"
              disabled={disabled || saving}
            />
            <TextField
              label="Fuel level (%)"
              value={tankLevelPct}
              onChange={(e) => setTankLevelPct(e.target.value)}
              size="small"
              fullWidth
              type="number"
              disabled={disabled || saving}
              helperText="0–100 (telemetry)"
            />
            <TextField
              label="Odometer (km)"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              size="small"
              fullWidth
              type="number"
              disabled={disabled || saving}
            />
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Pump (optional): enter both start and end to compute litres; otherwise use actual litres.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Pump start (L)"
              value={pumpStart}
              onChange={(e) => setPumpStart(e.target.value)}
              size="small"
              fullWidth
              type="number"
              disabled={disabled || saving}
            />
            <TextField
              label="Pump end (L)"
              value={pumpEnd}
              onChange={(e) => setPumpEnd(e.target.value)}
              size="small"
              fullWidth
              type="number"
              disabled={disabled || saving}
            />
          </Stack>

          <Divider flexItem />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <TextField
              label="Actual fuel (L)"
              value={actualFuelLitres}
              onChange={(e) => setActualFuelLitres(e.target.value)}
              size="small"
              fullWidth
              type="number"
              disabled={disabled || saving}
              helperText="If pump fields are filled, they take precedence"
            />
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={disabled || saving}
              sx={{ flexShrink: 0 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default RefuelCard;
