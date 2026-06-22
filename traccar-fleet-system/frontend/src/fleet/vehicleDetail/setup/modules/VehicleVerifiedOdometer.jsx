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
  fetchVehicleOdometer,
  verifyVehicleOdometer,
  fuelApiErrorMessage,
} from '../../../vehiclesApi.js';
import { useManager } from '../../../../common/util/permissions';

const fmtKm = (km) => (km != null && Number.isFinite(Number(km))
  ? `${Number(km).toLocaleString()} km`
  : '—');

const fmtDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
};

export default function VehicleVerifiedOdometer({ deviceId }) {
  const user = useSelector((state) => state.session.user);
  const isManager = useManager();
  const [data, setData] = useState(null);
  const [manualKm, setManualKm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => {
    if (!user || deviceId == null) return;
    try {
      const result = await fetchVehicleOdometer(user, deviceId);
      setData(result);
      setError('');
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to load odometer'));
    }
  }, [user, deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async (km, source) => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await verifyVehicleOdometer(user, deviceId, { verifiedOdometerKm: km, source });
      setManualKm('');
      setInfo('Verified odometer updated.');
      await load();
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to update verified odometer'));
    } finally {
      setBusy(false);
    }
  };

  const verifiedDate = fmtDate(data?.verifiedOdometerAt);

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        Verified odometer
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Verified:
        {' '}
        <strong>{fmtKm(data?.verifiedOdometerKm)}</strong>
        {data?.verifiedOdometerSource ? ` · ${data.verifiedOdometerSource}` : ''}
        {verifiedDate ? ` · ${verifiedDate}` : ''}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Computed now:
        {' '}
        <strong>{fmtKm(data?.odometer)}</strong>
        {data?.source ? ` (${data.source})` : ''}
      </Typography>

      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      {info && <Alert severity="success" sx={{ mt: 1 }}>{info}</Alert>}

      {isManager && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }} alignItems={{ sm: 'center' }}>
          <TextField
            label="Set verified km"
            type="number"
            size="small"
            value={manualKm}
            onChange={(e) => setManualKm(e.target.value)}
            disabled={busy}
            sx={{ maxWidth: 180 }}
          />
          <Button
            size="small"
            variant="outlined"
            disabled={busy || manualKm === ''}
            onClick={() => verify(manualKm, 'manual')}
          >
            Save reading
          </Button>
          {data?.traccarTotalDistance != null && (
            <Button
              size="small"
              disabled={busy}
              onClick={() => verify(data.traccarTotalDistance, 'audit')}
            >
              Trust dashboard ({fmtKm(data.traccarTotalDistance)})
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
