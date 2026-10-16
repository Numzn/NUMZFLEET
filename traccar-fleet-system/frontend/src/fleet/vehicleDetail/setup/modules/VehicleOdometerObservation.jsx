import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  fetchVehicleOdometerState,
  recordOdometerObservation,
  fuelApiErrorMessage,
} from '../../../vehiclesApi.js';
import { useManager } from '../../../../common/util/permissions';
import { describeOdometerStatus } from '../../../display/odometerStatus.js';
import {
  MIN_REASON_CHARS,
  buildObservationPayload,
  canSubmitObservation,
} from './odometerObservationPayload.js';

const fmtKm = (km) => (km != null && Number.isFinite(Number(km))
  ? `${Number(km).toLocaleString()} km`
  : '—');

const confidenceLabel = (value) => {
  if (!value) return null;
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
};

export default function VehicleOdometerObservation({ fleetVehicleId }) {
  const user = useSelector((state) => state.session.user);
  const isManager = useManager();
  const [data, setData] = useState(null);
  const [manualKm, setManualKm] = useState('');
  const [attested, setAttested] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => {
    if (!user || !fleetVehicleId) return;
    try {
      const result = await fetchVehicleOdometerState(user, fleetVehicleId);
      setData(result);
      setError('');
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to load odometer'));
    }
  }, [user, fleetVehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitReading = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await recordOdometerObservation(user, fleetVehicleId, buildObservationPayload({
        odometerKm: manualKm,
        attestedFromDashboard: attested,
        reason,
      }));
      setManualKm('');
      setReason('');
      setAttested(false);
      setInfo('Dashboard reading recorded and verified.');
      await load();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to record odometer reading'));
    } finally {
      setBusy(false);
    }
  };

  const status = describeOdometerStatus(data);

  const driftPct = data?.odometerDriftPct;
  const driftClass = data?.odometerDriftClass;
  const driftLabel = driftClass && driftClass !== 'unknown'
    ? String(driftClass).replace(/_/g, ' ')
    : (driftClass === 'unknown' ? 'unknown' : null);

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        Odometer
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Live reading:
        {' '}
        <strong>{fmtKm(data?.odometerKm)}</strong>
        {data?.odometerConfidence ? ` · ${confidenceLabel(data.odometerConfidence)} confidence` : ''}
      </Typography>
      {status.state !== 'none' && (
        <Typography
          variant="body2"
          color={status.tone === 'warn' ? 'warning.main' : 'text.secondary'}
          fontWeight={status.tone === 'warn' ? 600 : 400}
        >
          {status.label}
          {status.age ? ` · last reading ${status.age}` : ''}
        </Typography>
      )}
      {status.details.map((line) => (
        <Typography key={line} variant="caption" color="text.secondary" display="block">
          {line}
        </Typography>
      ))}
      <Typography variant="body2" color="text.secondary">
        Drift vs last observation:
        {' '}
        {driftPct != null ? (
          <>
            <strong>{Number(driftPct).toFixed(2)}%</strong>
            {driftLabel && driftLabel !== 'unknown' ? ` (${driftLabel})` : ''}
          </>
        ) : (
          <strong>unknown</strong>
        )}
      </Typography>

      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      {info && <Alert severity="success" sx={{ mt: 1 }}>{info}</Alert>}

      {isManager && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <TextField
              label="Dashboard reading (km)"
              type="number"
              size="small"
              value={manualKm}
              onChange={(e) => setManualKm(e.target.value)}
              disabled={busy}
              sx={{ maxWidth: 220 }}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={busy || !canSubmitObservation({ odometerKm: manualKm, attestedFromDashboard: attested })}
              onClick={submitReading}
            >
              Save reading
            </Button>
          </Stack>
          <FormControlLabel
            control={(
              <Checkbox
                size="small"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
                disabled={busy}
              />
            )}
            label="I read this value from the vehicle’s own odometer"
          />
          <TextField
            label="Reason (needed to correct a verified odometer)"
            size="small"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            helperText={`At least ${MIN_REASON_CHARS} characters when lowering a verified reading or raising it by more than the vehicle could have driven.`}
          />
        </Stack>
      )}
    </Box>
  );
}
