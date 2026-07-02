import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
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

  const recordObservation = async (km, source) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await recordOdometerObservation(user, fleetVehicleId, { odometerKm: km, source });
      setManualKm('');
      setInfo('Dashboard reading recorded.');
      await load();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to record odometer reading'));
    } finally {
      setBusy(false);
    }
  };

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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }} alignItems={{ sm: 'center' }}>
          <TextField
            label="Record dashboard reading (km)"
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
            disabled={busy || manualKm === ''}
            onClick={() => recordObservation(manualKm, 'manual')}
          >
            Save reading
          </Button>
          {data?.odometerKm != null && (
            <Button
              size="small"
              disabled={busy}
              onClick={() => recordObservation(data.odometerKm, 'audit')}
            >
              Trust live reading ({fmtKm(data.odometerKm)})
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
