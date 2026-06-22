import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import { fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import { fetchDailyOperationReports } from './api/operationSessionsApi.js';
import { formatLitres } from './utils/formatters.js';
import {
  getTodayKeyInTimeZone,
  resolveFleetTimezone,
} from './utils/operationDayUtils.js';

const INVOICE_LABEL = { matched: 'Matched', variance: 'Variance', pending: 'Pending' };
const INVOICE_COLOR = { matched: 'success', variance: 'error', pending: 'default' };

// History rows carry only the stored status (no per-vehicle detail), so map the
// database lifecycle directly to operations language.
const HISTORY_STATUS_LABEL = { draft: 'Planning', approved: 'In Progress', locked: 'Closed' };
const HISTORY_STATUS_COLOR = { draft: 'warning', approved: 'primary', locked: 'default' };
const historyStatusLabel = (status) => HISTORY_STATUS_LABEL[String(status || '').toLowerCase()] || 'Planning';
const historyStatusColor = (status) => HISTORY_STATUS_COLOR[String(status || '').toLowerCase()] || 'default';

const OperationHistoryPage = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.session.user);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchDailyOperationReports(user, {});
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(fuelApiErrorMessage(err, 'Failed to load operation history'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedRows = [...rows].sort((a, b) => String(b.calendarDate).localeCompare(String(a.calendarDate)));
  const todayKey = getTodayKeyInTimeZone(resolveFleetTimezone(rows));

  return (
    <Stack spacing={RUNTIME_STACK_GAP}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" variant="outlined" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && sortedRows.length === 0 && (
        <Alert severity="info">No fueling days yet.</Alert>
      )}

      {!loading && sortedRows.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Forecast</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Variance</TableCell>
                <TableCell align="right">Accuracy</TableCell>
                <TableCell>Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.map((row) => {
                const variance = row.varianceLitres != null ? Number(row.varianceLitres) : null;
                const isToday = String(row.calendarDate).slice(0, 10) === todayKey;
                return (
                  <TableRow
                    key={row.operationId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/fleet/operation-sessions/fuel/${row.operationId}`)}
                  >
                    <TableCell>
                      {row.calendarDate}
                      {isToday && (
                        <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 1 }}>
                          Today
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{row.reference || row.operationId}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={historyStatusLabel(row.status)}
                        color={historyStatusColor(row.status)}
                      />
                    </TableCell>
                    <TableCell align="right">{formatLitres(row.forecastLitres)}</TableCell>
                    <TableCell align="right">{formatLitres(row.actualLitres)}</TableCell>
                    <TableCell align="right">
                      {variance != null && Number.isFinite(variance)
                        ? `${variance >= 0 ? '+' : ''}${variance.toFixed(1)} L`
                        : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {row.forecastAccuracyPercent != null ? `${row.forecastAccuracyPercent}%` : '—'}
                    </TableCell>
                    <TableCell>
                      {row.invoiceStatus ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            row.invoiceCount > 1
                              ? `${INVOICE_LABEL[row.invoiceStatus] || row.invoiceStatus} (${row.invoiceCount})`
                              : (INVOICE_LABEL[row.invoiceStatus] || row.invoiceStatus)
                          }
                          color={INVOICE_COLOR[row.invoiceStatus] || 'default'}
                        />
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
};

export default OperationHistoryPage;
