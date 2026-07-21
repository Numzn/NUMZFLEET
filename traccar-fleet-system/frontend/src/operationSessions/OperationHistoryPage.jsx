import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import { fetchVehicles, fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import { resolveVehicleDisplayFromFleetRow } from '../fleet/display/resolveVehicleDisplay.js';
import { vehicleWorkspacePath } from '../fleet/vehicleRegistry/vehicleRegistryUtils.js';
import { fetchDailyOperationReports, fetchOperationSessionDetails } from './api/operationSessionsApi.js';
import { formatK, formatLitres } from './utils/formatters.js';
import {
  deriveVehicleWorkflowState,
  getTodayKeyInTimeZone,
  isRefuelComplete,
  relativeDayLabel,
  resolveFleetTimezone,
  varianceTone,
  VEHICLE_STATE_LABEL,
  vehicleStateChipColor,
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

// 'pending' from the backend means "not yet reconciled" — it's returned
// identically whether no invoice exists at all or one is attached but its
// litres/cost were never entered (no OCR/reconciliation is wired up today).
// Disambiguate using invoiceCount so the badge reflects the real document
// state (Missing/Attached) instead of implying a processing step is pending.
const INVOICE_LABEL = { matched: 'Matched', variance: 'Variance' };
const INVOICE_COLOR = { matched: 'success', variance: 'error' };

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

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString([], {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatPricePerLitre(detail) {
  const single = detail?.approvedFuelPrice;
  if (single != null) return formatK(single);
  const diesel = detail?.approvedDieselPrice;
  const petrol = detail?.approvedPetrolPrice;
  if (diesel != null && petrol != null) return `${formatK(diesel)} D / ${formatK(petrol)} P`;
  if (diesel != null) return formatK(diesel);
  if (petrol != null) return formatK(petrol);
  return null;
}

function varianceLabel(variance) {
  return variance != null && Number.isFinite(variance)
    ? `${variance >= 0 ? '+' : ''}${variance.toFixed(1)} L`
    : '—';
}

// Compact summary card for the History Summary strip: tinted icon badge,
// bold value, uppercase caption label — the History-scale sibling of the
// dashboard's ModernKPICard, restyled with plain theme colors so it sits
// naturally on this page.
function KpiCard({ icon, label, value, tone = 'primary' }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 }, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            bgcolor: (theme) => theme.palette[tone].main + '22',
            color: `${tone}.main`,
            '& svg': { fontSize: '1.15rem' },
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontWeight: 700,
              letterSpacing: 0.5,
              fontSize: '0.62rem',
              color: 'text.secondary',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </Typography>
          <Typography variant="body1" fontWeight={800} noWrap>{value}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// Uppercase label / normal-case value pairing, used on mobile session cards so
// field names (STATUS, FORECAST, ACTUAL...) scan quickly while the values
// themselves — the numbers operators actually need to read — stay easy to read.
function StatCell({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontWeight: 700,
          letterSpacing: 0.5,
          fontSize: '0.65rem',
          color: 'text.secondary',
          textTransform: 'uppercase',
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Typography variant="body2" fontWeight={700} noWrap>{value}</Typography>
      ) : value}
    </Box>
  );
}

function InvoiceChip({ row }) {
  // Backend sends invoiceStatus: null when invoiceCount is 0 (see
  // operationReportingService.js) — that's a genuinely missing document,
  // distinct from an attached-but-unreconciled one.
  if (!row.invoiceCount) {
    return <Chip size="small" variant="outlined" label="Missing" color="default" />;
  }
  const label = INVOICE_LABEL[row.invoiceStatus] || 'Attached';
  const color = INVOICE_COLOR[row.invoiceStatus] || 'info';
  return (
    <Chip
      size="small"
      variant="outlined"
      label={row.invoiceCount > 1 ? `${label} (${row.invoiceCount})` : label}
      color={color}
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

  const fueledCount = detail
    ? (detail.refuels || []).filter(isRefuelComplete).length
    : row.vehiclesFueled;
  const pricePerLitre = formatPricePerLitre(detail);
  const attendants = [...new Set(
    (detail?.refuels || []).map((r) => String(r.attendant || '').trim()).filter(Boolean),
  )];
  const completedAt = formatDateTime(detail?.lockedAt);
  const stats = [
    { label: 'Fuel Cost', value: formatK(detail?.totalActualCost ?? row.actualCost) },
    pricePerLitre != null && { label: 'Price / Litre', value: pricePerLitre },
    fueledCount != null && { label: 'Vehicles Fueled', value: fueledCount },
    (detail?.stationName || row.stationName) && { label: 'Station', value: detail?.stationName || row.stationName },
    attendants.length > 0 && { label: 'Recorded By', value: attendants.join(', ') },
    completedAt && { label: 'Completed At', value: completedAt },
  ].filter(Boolean);

  return (
    <Box sx={{ py: 1 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        {stats.map((stat) => (
          <StatCell key={stat.label} label={stat.label} value={stat.value} />
        ))}
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
  const invoices = detail.invoices || [];
  const refuelsById = new Map(refuels.map((r) => [Number(r.id), r]));

  return (
    <>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 0.4 }}>
        VEHICLES
      </Typography>
      {refuels.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
          No vehicles recorded
        </Typography>
      ) : (
        <Stack sx={{ mt: 0.5, mb: 1.5 }}>
          {refuels.map((refuel) => {
            const state = deriveVehicleWorkflowState(refuel);
            const fueled = isRefuelComplete(refuel);
            const predicted = predictedLitres(refuel);
            const actual = refuel.actualFuelLitres != null ? Number(refuel.actualFuelLitres) : null;
            const tone = varianceTone(predicted, actual);
            const showVariance = fueled && (tone === 'warning' || tone === 'error') && predicted != null && actual != null;
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={VEHICLE_STATE_LABEL[state] || state}
                      color={vehicleStateChipColor(state)}
                      sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '10px' } }}
                    />
                    {fuelType && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                        {fuelType}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" fontWeight={700}>
                    {fueled && refuel.actualCost != null ? formatK(refuel.actualCost) : '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {fueled ? formatLitres(actual) : (predicted != null ? formatLitres(predicted) : '—')}
                    {fueled && predicted != null && ` / ${formatLitres(predicted)} predicted`}
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

  // Date range filters via the backend's existing from/to params; vehicle and
  // station narrow the already-fetched rows client-side.
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [fleetVehicles, setFleetVehicles] = useState([]);

  const [expandedId, setExpandedId] = useState(null);
  const [detailsById, setDetailsById] = useState({});
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [detailErrorId, setDetailErrorId] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const query = {};
      if (fromDate) query.from = fromDate;
      if (toDate) query.to = toDate;
      const data = await fetchDailyOperationReports(user, query);
      setRows(Array.isArray(data) ? data : []);
      setExpandedId(null);
      setDetailsById({});
    } catch (err) {
      setError(fuelApiErrorMessage(err, 'Failed to load operation history'));
    } finally {
      setLoading(false);
    }
  }, [user, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    fetchVehicles(user).then(
      (data) => setFleetVehicles(Array.isArray(data) ? data : []),
      () => setFleetVehicles([]),
    );
  }, [user]);

  const vehicleOptions = useMemo(
    () => fleetVehicles
      .filter((v) => v.assignment?.deviceId != null)
      .map((v) => {
        const display = resolveVehicleDisplayFromFleetRow(v);
        return {
          deviceId: Number(v.assignment.deviceId),
          label: display.secondary ? `${display.primary} (${display.secondary})` : display.primary,
        };
      }),
    [fleetVehicles],
  );

  const stationOptions = useMemo(
    () => [...new Set(rows.map((r) => String(r.stationName || '').trim()).filter(Boolean))].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (vehicleFilter !== '' && !(row.fueledVehicleIds || []).includes(Number(vehicleFilter))) return false;
    if (stationFilter !== '' && String(row.stationName || '').trim() !== stationFilter) return false;
    return true;
  }), [rows, vehicleFilter, stationFilter]);

  // History Summary aggregates — computed from the filtered rows so the cards
  // and the timeline always describe the same set of sessions.
  const summary = useMemo(() => {
    const vehicleIds = new Set();
    let totalSpend = 0;
    let totalLitres = 0;
    for (const row of filteredRows) {
      totalSpend += Number(row.actualCost || 0);
      totalLitres += Number(row.actualLitres || 0);
      for (const id of row.fueledVehicleIds || []) vehicleIds.add(Number(id));
    }
    return {
      totalSpend,
      totalLitres,
      vehiclesFueled: vehicleIds.size,
      sessions: filteredRows.length,
    };
  }, [filteredRows]);

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

  const sortedRows = [...filteredRows].sort((a, b) => String(b.calendarDate).localeCompare(String(a.calendarDate)));
  const todayKey = getTodayKeyInTimeZone(resolveFleetTimezone(rows));
  const hasActiveFilters = Boolean(fromDate || toDate || vehicleFilter !== '' || stationFilter !== '');

  return (
    <Stack spacing={RUNTIME_STACK_GAP}>
      {/* History Summary — aggregates of the filtered sessions below */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.25,
        }}
      >
        <KpiCard icon={<PaymentsOutlinedIcon />} label="Total Spend" value={formatK(summary.totalSpend)} tone="success" />
        <KpiCard icon={<LocalGasStationOutlinedIcon />} label="Total Litres" value={formatLitres(summary.totalLitres)} tone="info" />
        <KpiCard icon={<DirectionsCarFilledOutlinedIcon />} label="Vehicles Fueled" value={summary.vehiclesFueled} tone="secondary" />
        <KpiCard icon={<ReceiptLongOutlinedIcon />} label="Sessions" value={summary.sessions} tone="warning" />
      </Box>

      {/* Filters — date range refetches (backend from/to); vehicle and station filter client-side */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr) auto' },
          gap: 1,
          alignItems: 'center',
        }}
      >
        <TextField
          size="small"
          label="From"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          select
          label="Vehicle"
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
        >
          <MenuItem value="">All vehicles</MenuItem>
          {vehicleOptions.map((option) => (
            <MenuItem key={option.deviceId} value={option.deviceId}>{option.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Station"
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
        >
          <MenuItem value="">All stations</MenuItem>
          {stationOptions.map((station) => (
            <MenuItem key={station} value={station}>{station}</MenuItem>
          ))}
        </TextField>
        <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
          {loading && rows.length > 0 && <CircularProgress size={16} />}
          <Button size="small" variant="outlined" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && rows.length === 0 && (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && sortedRows.length === 0 && (
        <Alert severity="info">
          {hasActiveFilters ? 'No fueling days match the current filters.' : 'No fueling days yet.'}
        </Alert>
      )}

      {sortedRows.length > 0 && isMobile && (
        <Stack spacing={1.25}>
          {sortedRows.map((row) => {
            const variance = row.varianceLitres != null ? Number(row.varianceLitres) : null;
            const expanded = expandedId === row.operationId;
            return (
              <Card key={row.operationId} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box
                  onClick={() => toggleRow(row.operationId)}
                  sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, p: 1.5, cursor: 'pointer' }}
                >
                  <IconButton size="small" sx={{ mt: -0.25, ml: -0.75 }}>
                    {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                    >
                      {relativeDayLabel(row.calendarDate, todayKey)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                      {row.reference || row.operationId}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <StatCell
                        label="Status"
                        value={<Chip size="small" label={historyStatusLabel(row.status)} color={historyStatusColor(row.status)} />}
                      />
                      <StatCell label="Forecast" value={formatLitres(row.forecastLitres)} />
                      <StatCell label="Actual" value={formatLitres(row.actualLitres)} />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
                      <StatCell label="Variance" value={varianceLabel(variance)} />
                      <StatCell
                        label="Accuracy"
                        value={row.forecastAccuracyPercent != null ? `${row.forecastAccuracyPercent}%` : '—'}
                      />
                      <StatCell label="Invoice" value={<InvoiceChip row={row} />} />
                    </Box>
                  </Box>
                </Box>
                <Collapse in={expanded} unmountOnExit>
                  <Divider />
                  <Box sx={{ pl: 5, pr: 1.5, py: 1 }}>
                    <SessionRecordDetail
                      row={row}
                      detail={detailsById[row.operationId]}
                      loading={expanded && detailLoadingId === row.operationId}
                      error={expanded ? detailErrorId : null}
                    />
                  </Box>
                </Collapse>
              </Card>
            );
          })}
        </Stack>
      )}

      {sortedRows.length > 0 && !isMobile && (
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
