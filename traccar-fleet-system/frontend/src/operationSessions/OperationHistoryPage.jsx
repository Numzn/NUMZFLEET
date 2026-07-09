import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import { fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import { vehicleWorkspacePath } from '../fleet/vehicleRegistry/vehicleRegistryUtils.js';
import { fetchDailyOperationReports, fetchOperationSessionDetails } from './api/operationSessionsApi.js';
import { formatK, formatLitres } from './utils/formatters.js';
import {
  getTodayKeyInTimeZone,
  isRefuelComplete,
  relativeDayLabel,
  resolveFleetTimezone,
  varianceTone,
} from './utils/operationDayUtils.js';
import { useVehicleDisplayContext } from '../fleet/display/VehicleDisplayRegistryContext';
import OperationVehicleLabel from './components/OperationVehicleLabel.jsx';

const FUEL_TYPE_LABEL = { diesel: 'Diesel', petrol: 'Petrol' };
const VARIANCE_COLOR = { warning: 'warning.main', error: 'error.main' };

function predictedLitres(refuel) {
  const planned = refuel.plannedFuelLitres != null ? Number(refuel.plannedFuelLitres) : null;
  if (planned != null && Number.isFinite(planned) && planned > 0) return planned;
  const estimated = refuel.estimatedFuelLitres != null ? Number(refuel.estimatedFuelLitres) : null;
  return Number.isFinite(estimated) ? estimated : null;
}

const INVOICE_LABEL = { matched: 'Matched', variance: 'Variance', pending: 'Pending' };
const INVOICE_COLOR = { matched: 'success', variance: 'error', pending: 'default' };

// History rows carry only the stored status (no per-vehicle detail), so map the
// database lifecycle directly to operations language.
const HISTORY_STATUS_LABEL = { draft: 'Planning', approved: 'In Progress', locked: 'Closed' };
const HISTORY_STATUS_COLOR = { draft: 'warning', approved: 'primary', locked: 'default' };
const historyStatusLabel = (status) => HISTORY_STATUS_LABEL[String(status || '').toLowerCase()] || 'Planning';
const historyStatusColor = (status) => HISTORY_STATUS_COLOR[String(status || '').toLowerCase()] || 'default';

function invoiceTitle(invoice) {
  if (invoice.invoiceNumber) return invoice.invoiceNumber;
  if (invoice.attachmentUrl) return 'Station invoice';
  return 'Smart Invoice';
}

function varianceLabel(variance) {
  return variance != null && Number.isFinite(variance)
    ? `${variance >= 0 ? '+' : ''}${variance.toFixed(1)} L`
    : '—';
}

function InvoiceChip({ row }) {
  if (!row.invoiceStatus) return '—';
  return (
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
  );
}

/** Real session record: fueled vehicles (OperationSessionRefuel) + attachments and their coverage. */
function SessionRecordDetail({
  row, detail, loading, error,
}) {
  const navigate = useNavigate();
  const devicesItems = useSelector((state) => state.devices.items || {});
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const vehicleName = (vehicleId) => getDisplayForDevice(vehicleId, devicesItems[vehicleId])?.primary || `Vehicle ${vehicleId}`;

  const goToVehicleFuel = (vehicleId) => {
    const fleetVehicleId = getDisplayForDevice(vehicleId, devicesItems[vehicleId])?.fleetVehicleId;
    if (!fleetVehicleId) return;
    navigate(`${vehicleWorkspacePath(fleetVehicleId)}?tab=fuel`);
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 0.75, mb: 1 }}>
        <Typography variant="body2" fontWeight={700}>{formatK(row.actualCost)}</Typography>
        <Typography variant="caption" color="text.secondary">· {formatLitres(row.actualLitres)}</Typography>
        <Chip size="small" label={historyStatusLabel(row.status)} color={historyStatusColor(row.status)} />
      </Box>

      {loading && (
        <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={20} />
        </Box>
      )}
      {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
      {!loading && !error && detail && (
        <SessionRecordVehiclesAndAttachments detail={detail} vehicleName={vehicleName} onVehicleClick={goToVehicleFuel} />
      )}
    </Box>
  );
}

function SessionRecordVehiclesAndAttachments({ detail, vehicleName, onVehicleClick }) {
  const refuels = detail.refuels || [];
  const fueledRefuels = refuels.filter(isRefuelComplete);
  const invoices = detail.invoices || [];
  const refuelsById = new Map(refuels.map((r) => [Number(r.id), r]));

  return (
    <>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 0.4 }}>
        VEHICLES
      </Typography>
      {fueledRefuels.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
          No vehicles recorded
        </Typography>
      ) : (
        <Stack sx={{ mt: 0.5, mb: 1.5 }}>
          {fueledRefuels.map((refuel) => {
            const predicted = predictedLitres(refuel);
            const actual = refuel.actualFuelLitres != null ? Number(refuel.actualFuelLitres) : null;
            const tone = varianceTone(predicted, actual);
            const showVariance = (tone === 'warning' || tone === 'error') && predicted != null && actual != null;
            const variance = showVariance ? actual - predicted : null;
            const fuelType = FUEL_TYPE_LABEL[String(refuel.fuelTypeSnapshot || '').toLowerCase()];
            return (
              <Box
                key={refuel.id}
                onClick={() => onVehicleClick(refuel.vehicleId)}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  py: 0.75,
                  borderBottom: 1,
                  borderColor: 'divider',
                  cursor: 'pointer',
                }}
              >
                <Box>
                  <OperationVehicleLabel
                    deviceId={refuel.vehicleId}
                    titleVariant="body2"
                    titleWeight={700}
                    secondarySx={{ fontSize: '12px' }}
                  />
                  {fuelType && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                      {fuelType}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight={700}>
                    {refuel.actualCost != null ? formatK(refuel.actualCost) : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {formatLitres(actual)}
                    {predicted != null && ` / ${formatLitres(predicted)} predicted`}
                  </Typography>
                  {showVariance && (
                    <Typography variant="caption" fontWeight={700} sx={{ color: VARIANCE_COLOR[tone] }}>
                      {`${variance >= 0 ? '+' : ''}${variance.toFixed(1)} L ${variance >= 0 ? '↑' : '↓'}`}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}

      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 0.4 }}>
        ATTACHMENTS
      </Typography>
      {invoices.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          No attachments recorded
        </Typography>
      ) : (
        <Stack sx={{ mt: 0.5 }} spacing={1}>
          {invoices.map((invoice) => {
            const coveredIds = invoice.coveredRefuelIds || [];
            const coversLabel = coveredIds.length === 0
              ? 'Session-level attachment — no vehicle coverage recorded'
              : `Covers: ${coveredIds
                .map((id) => refuelsById.get(Number(id)))
                .filter(Boolean)
                .map((r) => vehicleName(r.vehicleId))
                .join(', ')}`;
            return (
              <Box key={invoice.id}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={700}>{invoiceTitle(invoice)}</Typography>
                  {invoice.attachmentUrl && (
                    <Typography
                      component="a"
                      href={invoice.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="caption"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, whiteSpace: 'nowrap' }}
                    >
                      View
                      <OpenInNewIcon sx={{ fontSize: '0.85rem' }} />
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">{coversLabel}</Typography>
              </Box>
            );
          })}
        </Stack>
      )}
    </>
  );
}

const OperationHistoryPage = () => {
  const user = useSelector((state) => state.session.user);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [expandedId, setExpandedId] = useState(null);
  const [detailsById, setDetailsById] = useState({});
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [detailErrorId, setDetailErrorId] = useState(null);

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

  const toggleRow = useCallback((operationId) => {
    setExpandedId((current) => (current === operationId ? null : operationId));
  }, []);

  // Lazy-load session detail (refuels + invoices/coverage) for the one expanded row only.
  useEffect(() => {
    if (expandedId == null || detailsById[expandedId] || !user) return;
    let cancelled = false;
    setDetailLoadingId(expandedId);
    setDetailErrorId(null);
    fetchOperationSessionDetails(user, expandedId)
      .then((data) => {
        if (cancelled) return;
        setDetailsById((prev) => ({ ...prev, [expandedId]: data }));
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailErrorId(fuelApiErrorMessage(err, 'Failed to load session record'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoadingId(null);
      });
    return () => { cancelled = true; };
  }, [expandedId, detailsById, user]);

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

      {!loading && sortedRows.length > 0 && isMobile && (
        <Stack spacing={0}>
          {sortedRows.map((row) => {
            const variance = row.varianceLitres != null ? Number(row.varianceLitres) : null;
            const expanded = expandedId === row.operationId;
            return (
              <Box key={row.operationId} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Box
                  onClick={() => toggleRow(row.operationId)}
                  sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 1, cursor: 'pointer' }}
                >
                  <IconButton size="small" sx={{ mt: -0.25 }}>
                    {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {relativeDayLabel(row.calendarDate, todayKey)}
                      </Typography>
                      <Chip size="small" label={historyStatusLabel(row.status)} color={historyStatusColor(row.status)} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {row.reference || row.operationId}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Forecast {formatLitres(row.forecastLitres)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Actual {formatLitres(row.actualLitres)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {varianceLabel(variance)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.forecastAccuracyPercent != null ? `${row.forecastAccuracyPercent}%` : '—'}
                      </Typography>
                      <InvoiceChip row={row} />
                    </Box>
                  </Box>
                </Box>
                <Collapse in={expanded} unmountOnExit>
                  <Box sx={{ pl: 4, pr: 1 }}>
                    <SessionRecordDetail
                      row={row}
                      detail={detailsById[row.operationId]}
                      loading={expanded && detailLoadingId === row.operationId}
                      error={expanded ? detailErrorId : null}
                    />
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      )}

      {!loading && sortedRows.length > 0 && !isMobile && (
        <Paper variant="outlined" sx={{ overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40, px: 0.5 }} />
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
                const expanded = expandedId === row.operationId;
                return (
                  <Fragment key={row.operationId}>
                    <TableRow
                      hover
                      sx={{ cursor: 'pointer', '& > *': { borderBottom: expanded ? 0 : undefined } }}
                      onClick={() => toggleRow(row.operationId)}
                    >
                      <TableCell sx={{ px: 0.5 }}>
                        <IconButton size="small">
                          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        {relativeDayLabel(row.calendarDate, todayKey)}
                      </TableCell>
                      <TableCell>{row.reference || row.operationId}</TableCell>
                      <TableCell>
                        <Chip size="small" label={historyStatusLabel(row.status)} color={historyStatusColor(row.status)} />
                      </TableCell>
                      <TableCell align="right">{formatLitres(row.forecastLitres)}</TableCell>
                      <TableCell align="right">{formatLitres(row.actualLitres)}</TableCell>
                      <TableCell align="right">{varianceLabel(variance)}</TableCell>
                      <TableCell align="right">
                        {row.forecastAccuracyPercent != null ? `${row.forecastAccuracyPercent}%` : '—'}
                      </TableCell>
                      <TableCell><InvoiceChip row={row} /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={9} sx={{ p: 0, borderBottom: expanded ? 1 : 0, borderColor: 'divider' }}>
                        <Collapse in={expanded} unmountOnExit>
                          <Box sx={{ px: 2, py: 0.5 }}>
                            <SessionRecordDetail
                              row={row}
                              detail={detailsById[row.operationId]}
                              loading={expanded && detailLoadingId === row.operationId}
                              error={expanded ? detailErrorId : null}
                            />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
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
