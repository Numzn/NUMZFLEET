import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { fuelApiErrorMessage } from '../../fleet/vehiclesApi.js';
import {
  fetchDailyOperationReports,
  fetchManagementOperationReports,
} from '../api/operationSessionsApi.js';
import { formatLitres, formatZmw } from '../utils/formatters.js';

export default function OperationReportsSection() {
  const user = useSelector((state) => state.session.user);
  const [daily, setDaily] = useState([]);
  const [management, setManagement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        const [dailyRows, mgmt] = await Promise.all([
          fetchDailyOperationReports(user, {}),
          fetchManagementOperationReports(user, {}),
        ]);
        setDaily(Array.isArray(dailyRows) ? dailyRows.slice(0, 7) : []);
        setManagement(mgmt);
        setError('');
      } catch (err) {
        setError(fuelApiErrorMessage(err, 'Failed to load operation reports'));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle2" fontWeight={800}>Operations KPIs</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {management && (
        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Fleet summary</Typography>
          <Typography variant="body2" color="text.secondary">
            {management.operationCount}
            {' '}
            operations · Forecast accuracy
            {' '}
            {management.forecastAccuracyPercent != null ? `${management.forecastAccuracyPercent}%` : '—'}
            {' · '}
            Budget accuracy
            {' '}
            {management.budgetAccuracyPercent != null ? `${management.budgetAccuracyPercent}%` : '—'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {formatLitres(management.totalActualLitres)}
            {' '}
            dispensed ·
            {' '}
            {formatZmw(management.totalActualCost)}
          </Typography>
        </Paper>
      )}
      {daily.map((row) => (
        <Paper key={row.operationId} variant="outlined" sx={{ p: 1 }}>
          <Typography variant="body2" fontWeight={600}>{row.calendarDate}</Typography>
          <Typography variant="caption" color="text.secondary">
            Forecast
            {' '}
            {formatLitres(row.forecastLitres)}
            {' · '}
            Actual
            {' '}
            {formatLitres(row.actualLitres)}
            {' · '}
            Accuracy
            {' '}
            {row.forecastAccuracyPercent != null ? `${row.forecastAccuracyPercent}%` : '—'}
          </Typography>
        </Paper>
      ))}
    </Stack>
  );
}
