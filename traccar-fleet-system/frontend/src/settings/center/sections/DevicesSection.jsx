import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useTheme } from '@mui/material/styles';
import {
  Alert, Box, Button, Checkbox, CircularProgress, IconButton, InputAdornment,
  Menu, MenuItem, Pagination, Select, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TuneIcon from '@mui/icons-material/Tune';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { useDeviceReadonly, useManager, useRestriction } from '../../../common/util/permissions';
import { formatTime } from '../../../common/util/formatter';
import usePersistedState from '../../../common/util/usePersistedState';
import exportExcel from '../../../common/util/exportExcel';
import AddressValue from '../../../common/components/AddressValue';
import RemoveDialog from '../../../common/components/RemoveDialog';
import { useSetTopBarTitle } from '../../../common/components/TopBarTitleContext';
import { fetchVehicles } from '../../../fleet/vehiclesApi.js';
import { deleteFleetDevice, fetchFleetDeviceSnapshot } from '../../../fleet/fleetDevicesApi.js';
import { devicesActions } from '../../../store';
import SettingsCenterShell from '../SettingsCenterShell.jsx';
import SettingsSectionPanel from '../components/SettingsSectionPanel.jsx';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  buildAssignmentIndex,
  countTabs,
  decorateDevices,
  filterRows,
  paginate,
  toCsv,
} from './devices/deviceListModel.js';

const STATE_META = {
  online: { label: 'Online', color: 'var(--color-success)', background: 'var(--color-success-light)' },
  offline: { label: 'Offline', color: 'var(--color-critical)', background: 'var(--color-critical-light)' },
  never: { label: 'Never connected', color: 'var(--color-warning)', background: 'var(--color-warning-light)' },
};

const NEVER_HINT = 'No signal has ever been received from this tracker. Check that it is powered, has an active SIM and is pointed at the NUMZFLEET server.';

const TABS = [
  { value: 'all', label: 'All Devices' },
  { value: 'online', label: 'Online', dot: 'var(--color-success)' },
  { value: 'offline', label: 'Offline', dot: 'var(--color-critical)' },
  { value: 'never', label: 'Never connected', dot: 'var(--color-warning)' },
  { value: 'unassigned', label: 'Unassigned', dot: 'var(--color-text-disabled)' },
];

// Device, selection and actions are always shown; everything else is optional.
const COLUMNS = [
  { key: 'imei', label: 'Identifier (IMEI)', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'vehicle', label: 'Vehicle', defaultVisible: true },
  { key: 'lastSeen', label: 'Last seen', defaultVisible: true },
  { key: 'location', label: 'Location', defaultVisible: false },
];

const muted = { color: 'var(--color-text-secondary)' };

const headCellSx = {
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
  backgroundColor: 'var(--color-surface-alt)',
  borderBottom: '1px solid var(--color-border)',
};

const bodyCellSx = { borderBottom: '1px solid var(--color-border)', py: 1.25 };

// The default Paper surface is translucent in dark mode, so anything that floats
// over the table needs the opaque elevated surface to stay legible.
const popoverSlotProps = { paper: { sx: { backgroundColor: 'var(--surface-elevated)' } } };

const iconButtonSx = {
  borderRadius: '10px',
  backgroundColor: 'var(--color-surface-alt)',
  '&:hover': { backgroundColor: 'var(--color-border-light)' },
};

function StatusChip({ state }) {
  const meta = STATE_META[state];
  const chip = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        backgroundColor: meta.background,
        color: meta.color,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <FiberManualRecordIcon sx={{ fontSize: 10 }} />
      {meta.label}
    </Box>
  );
  return state === 'never' ? <Tooltip title={NEVER_HINT}>{chip}</Tooltip> : chip;
}

// "Offline" alone hides the case that matters most while onboarding: a tracker
// that was put on a vehicle but has never reported. Say so next to the chip.
const statusNote = (row, vehiclesStatus) => {
  if (row.state !== 'never') return null;
  if (row.vehicle?.assignedAt) {
    return `Assigned ${dayjs(row.vehicle.assignedAt).fromNow()}, no signal yet`;
  }
  return vehiclesStatus === 'ok' ? 'Not on a vehicle yet' : null;
};

function StatusNote({ row, vehiclesStatus }) {
  const note = statusNote(row, vehiclesStatus);
  if (!note) return null;
  return (
    <Typography
      variant="caption"
      component="div"
      sx={{ color: row.vehicle ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}
    >
      {note}
    </Typography>
  );
}

function StatusCell({ row, vehiclesStatus }) {
  return (
    <Box>
      <StatusChip state={row.state} />
      <Box sx={{ mt: 0.5 }}><StatusNote row={row} vehiclesStatus={vehiclesStatus} /></Box>
    </Box>
  );
}

function DeviceCell({ row }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0,
    }}
    >
      <Box sx={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: '10px',
        display: 'grid',
        placeItems: 'center',
        backgroundColor: 'var(--color-surface-alt)',
        ...muted,
      }}
      >
        <GpsFixedIcon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={700} noWrap>{row.name}</Typography>
        <Typography variant="body2" noWrap sx={muted}>{row.model || 'GPS tracker'}</Typography>
      </Box>
    </Box>
  );
}

function VehicleCell({ row, vehiclesStatus }) {
  if (row.vehicle) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, minWidth: 0,
      }}
      >
        <DirectionsCarIcon fontSize="small" sx={muted} />
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={600} noWrap>{row.vehicle.name}</Typography>
          {row.vehicle.plateNumber && (
            <Typography variant="body2" noWrap sx={muted}>{row.vehicle.plateNumber}</Typography>
          )}
        </Box>
      </Box>
    );
  }
  if (vehiclesStatus === 'ok') {
    return <Typography variant="body2" sx={muted}>Not assigned</Typography>;
  }
  const reason = vehiclesStatus === 'loading' ? 'Loading vehicles…' : 'Vehicle details need manager access';
  return (
    <Tooltip title={reason}>
      <Typography component="span" variant="body2" sx={muted}>—</Typography>
    </Tooltip>
  );
}

function LastSeenCell({ row }) {
  const content = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <AccessTimeIcon fontSize="small" sx={muted} />
      <Typography variant="body2" sx={row.lastUpdate ? {} : muted}>
        {row.lastUpdate ? dayjs(row.lastUpdate).fromNow() : 'Never'}
      </Typography>
    </Box>
  );
  return row.lastUpdate ? <Tooltip title={formatTime(row.lastUpdate, 'minutes')}>{content}</Tooltip> : content;
}

function RowActions({
  row, canEdit, onView, onEdit, onRemove,
}) {
  const t = useTranslation();
  return (
    <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
      <Tooltip title={row.vehicle ? 'Open vehicle' : 'Not assigned to a vehicle'}>
        <span>
          <IconButton size="small" aria-label="Open vehicle" disabled={!row.vehicle} onClick={() => onView(row)} sx={iconButtonSx}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {canEdit && (
        <>
          <Tooltip title={t('sharedEdit')}>
            <IconButton size="small" aria-label={t('sharedEdit')} onClick={() => onEdit(row)} sx={iconButtonSx}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('sharedRemove')}>
            <IconButton
              size="small"
              aria-label={t('sharedRemove')}
              onClick={() => onRemove(row)}
              sx={{ ...iconButtonSx, color: 'var(--color-critical)', backgroundColor: 'var(--color-critical-light)' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}

function TabLabel({ tab, count }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {tab.dot && <FiberManualRecordIcon sx={{ fontSize: 10, color: tab.dot }} />}
      <span>{tab.label}</span>
      {count != null && (
        <Box
          component="span"
          sx={{
            minWidth: 22,
            px: 0.75,
            borderRadius: '6px',
            fontSize: 12,
            lineHeight: '20px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-alt)',
            color: 'var(--color-text-primary)',
          }}
        >
          {count}
        </Box>
      )}
    </Box>
  );
}

// Byte-order mark so Excel reads the CSV as UTF-8. Built from a char code so the
// invisible character never ends up as a literal in the source.
const CSV_BOM = String.fromCharCode(0xfeff);

const downloadCsv = (records, filename) => {
  const blob = new Blob([`${CSV_BOM}${toCsv(records)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * Settings Center > Devices.
 *
 * The trackers are the caller's own company's: they come from fuel-api's
 * company-scoped device snapshot, and edit / remove go through fuel-api too.
 * Nothing here shows or edits Traccar's own structures (groups, connections,
 * accumulators, generic attributes, share links).
 *
 * Vehicle assignment comes from the company-scoped vehicles list, so the table
 * separates three things the old card list blurred together: whether a tracker
 * is reporting (Status), whether it is on a vehicle (Vehicle) and, for a tracker
 * that has never reported, how long it has been waiting.
 */
export default function DevicesSection() {
  useSetTopBarTitle('Settings');
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();
  const compact = useMediaQuery(theme.breakpoints.down('md'));

  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);
  const positions = useSelector((state) => state.session.positions);
  const manager = useManager();
  const deviceReadonly = useDeviceReadonly();
  const readonlyRestriction = useRestriction('readonly');

  const [timestamp, setTimestamp] = useState(Date.now());
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [vehicles, setVehicles] = useState(null);
  const [vehiclesStatus, setVehiclesStatus] = useState('loading');

  const [tab, setTab] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistedState('devicesTablePageSize', DEFAULT_PAGE_SIZE);
  const [columnPrefs, setColumnPrefs] = usePersistedState('devicesTableColumns', {});
  const [selected, setSelected] = useState(() => new Set());
  const [removeId, setRemoveId] = useState(null);
  const [exportAnchor, setExportAnchor] = useState(null);
  const [columnsAnchor, setColumnsAnchor] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await fetchFleetDeviceSnapshot(user);
        if (!cancelled) setDevices(Array.isArray(snapshot?.devices) ? snapshot.devices : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load devices.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [timestamp, user]);

  // Vehicles (and so assignments) are manager-only on the API. For anyone else the
  // Vehicle column and Unassigned tab are simply unavailable rather than wrong.
  useEffect(() => {
    if (!manager) {
      setVehicles(null);
      setVehiclesStatus('unavailable');
      return undefined;
    }
    let cancelled = false;
    setVehiclesStatus('loading');
    fetchVehicles(user)
      .then((data) => {
        if (cancelled) return;
        setVehicles(Array.isArray(data) ? data : []);
        setVehiclesStatus('ok');
      })
      .catch(() => {
        if (cancelled) return;
        setVehicles(null);
        setVehiclesStatus('unavailable');
      });
    return () => { cancelled = true; };
  }, [manager, user, timestamp]);

  // Drop selections for devices that no longer exist (e.g. after a remove).
  useEffect(() => {
    setSelected((previous) => {
      const ids = new Set(devices.map((device) => device.id));
      const next = new Set([...previous].filter((id) => ids.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [devices]);

  const vehiclesKnown = vehiclesStatus === 'ok';
  const assignmentIndex = useMemo(
    () => (vehiclesKnown ? buildAssignmentIndex(vehicles) : null),
    [vehiclesKnown, vehicles],
  );
  const rows = useMemo(() => decorateDevices(devices, assignmentIndex), [devices, assignmentIndex]);
  const counts = useMemo(() => countTabs(rows, vehiclesKnown), [rows, vehiclesKnown]);

  const activeTab = tab === 'unassigned' && !vehiclesKnown ? 'all' : tab;
  const filtered = useMemo(
    () => filterRows(rows, { tab: activeTab, keyword }),
    [rows, activeTab, keyword],
  );
  const paged = paginate(filtered, page, pageSize);

  const visible = Object.fromEntries(COLUMNS.map((column) => [
    column.key, columnPrefs[column.key] ?? column.defaultVisible,
  ]));

  const canEdit = !deviceReadonly;
  const canAdd = !readonlyRestriction;

  const pageIds = paged.items.map((row) => row.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));

  const toggleOne = (id) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllOnPage = () => setSelected((previous) => {
    const next = new Set(previous);
    pageIds.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)));
    return next;
  });

  const changeTab = (value) => { setTab(value); setPage(1); };
  const changeKeyword = (value) => { setKeyword(value); setPage(1); };
  const clearFilters = () => { setTab('all'); setKeyword(''); setPage(1); };

  const goView = (row) => row.vehicle && navigate(`/fleet/vehicles/${row.vehicle.vehicleId}`);
  const goEdit = (row) => navigate(`/settings/device/${row.id}`);
  const goAdd = () => navigate('/settings/device');

  const exportScope = selected.size ? rows.filter((row) => selected.has(row.id)) : filtered;
  const buildRecords = () => exportScope.map((row) => ({
    [t('sharedName')]: row.name,
    [t('deviceIdentifier')]: row.uniqueId,
    Vehicle: row.vehicle?.name ?? (vehiclesKnown ? 'Not assigned' : ''),
    'Plate number': row.vehicle?.plateNumber ?? '',
    [t('deviceStatus')]: STATE_META[row.state].label,
    [t('deviceLastUpdate')]: row.lastUpdate ? formatTime(row.lastUpdate, 'minutes') : 'Never',
    [t('sharedPhone')]: row.phone,
    [t('deviceModel')]: row.model,
    [t('positionAddress')]: positions[row.id]?.address || '',
  }));

  const handleExport = async (kind) => {
    setExportAnchor(null);
    const records = buildRecords();
    if (kind === 'csv') {
      downloadCsv(records, 'devices.csv');
      return;
    }
    const sheets = new Map();
    sheets.set(t('deviceTitle'), records);
    await exportExcel(t('deviceTitle'), 'devices.xlsx', sheets, theme);
  };

  const addButton = canAdd && (
    <Button variant="contained" startIcon={<AddIcon />} onClick={goAdd} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
      Add Device
    </Button>
  );

  const headerActions = (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <TextField
        size="small"
        placeholder="Search devices..."
        value={keyword}
        onChange={(event) => changeKeyword(event.target.value)}
        inputProps={{ 'aria-label': 'Search devices' }}
        sx={{ width: { xs: 150, sm: 280 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchIcon fontSize="small" sx={muted} /></InputAdornment>
          ),
        }}
      />
      {addButton}
    </Stack>
  );

  const renderCell = (row, key) => {
    switch (key) {
      case 'imei':
        return <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{row.uniqueId}</Typography>;
      case 'status':
        return <StatusCell row={row} vehiclesStatus={vehiclesStatus} />;
      case 'vehicle':
        return <VehicleCell row={row} vehiclesStatus={vehiclesStatus} />;
      case 'lastSeen':
        return <LastSeenCell row={row} />;
      case 'location':
        return positions[row.id] ? (
          <Typography variant="caption" component="div" sx={muted}>
            <AddressValue
              latitude={positions[row.id].latitude}
              longitude={positions[row.id].longitude}
              originalAddress={positions[row.id]?.address}
            />
          </Typography>
        ) : <Typography variant="body2" sx={muted}>—</Typography>;
      default:
        return null;
    }
  };

  const actionsFor = (row) => (
    <RowActions
      row={row}
      canEdit={canEdit}
      onView={goView}
      onEdit={goEdit}
      onRemove={(item) => setRemoveId(item.id)}
    />
  );

  const renderTable = () => (
    <TableContainer>
      <Table size="medium" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={headCellSx}>
              <Checkbox
                size="small"
                checked={allOnPage}
                indeterminate={!allOnPage && someOnPage}
                onChange={toggleAllOnPage}
                inputProps={{ 'aria-label': 'Select all devices on this page' }}
              />
            </TableCell>
            <TableCell sx={headCellSx}>Device</TableCell>
            {COLUMNS.filter((column) => visible[column.key]).map((column) => (
              <TableCell key={column.key} sx={headCellSx}>{column.label}</TableCell>
            ))}
            <TableCell align="right" sx={headCellSx}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paged.items.map((row) => (
            <TableRow key={row.id} hover selected={selected.has(row.id)}>
              <TableCell padding="checkbox" sx={bodyCellSx}>
                <Checkbox
                  size="small"
                  checked={selected.has(row.id)}
                  onChange={() => toggleOne(row.id)}
                  inputProps={{ 'aria-label': `Select ${row.name}` }}
                />
              </TableCell>
              <TableCell sx={bodyCellSx}><DeviceCell row={row} /></TableCell>
              {COLUMNS.filter((column) => visible[column.key]).map((column) => (
                <TableCell key={column.key} sx={bodyCellSx}>{renderCell(row, column.key)}</TableCell>
              ))}
              <TableCell align="right" sx={bodyCellSx}>{actionsFor(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderCards = () => (
    <Stack spacing={1.5}>
      {paged.items.map((row) => (
        <Box
          key={row.id}
          sx={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            p: 1.5,
            backgroundColor: selected.has(row.id) ? 'var(--color-surface-alt)' : 'transparent',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
              <Checkbox
                size="small"
                checked={selected.has(row.id)}
                onChange={() => toggleOne(row.id)}
                inputProps={{ 'aria-label': `Select ${row.name}` }}
                sx={{ ml: -1 }}
              />
              <DeviceCell row={row} />
            </Box>
            <StatusChip state={row.state} />
          </Box>
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {visible.imei && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" sx={muted}>IMEI</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{row.uniqueId}</Typography>
              </Box>
            )}
            {visible.vehicle && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" sx={muted}>Vehicle</Typography>
                <VehicleCell row={row} vehiclesStatus={vehiclesStatus} />
              </Box>
            )}
            {visible.lastSeen && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" sx={muted}>Last seen</Typography>
                <LastSeenCell row={row} />
              </Box>
            )}
            <StatusNote row={row} vehiclesStatus={vehiclesStatus} />
          </Stack>
          <Box sx={{ mt: 1.5 }}>{actionsFor(row)}</Box>
        </Box>
      ))}
    </Stack>
  );

  const list = compact ? renderCards() : renderTable();

  const showingText = paged.total <= paged.items.length
    ? `Showing ${paged.total} of ${paged.total} device${paged.total === 1 ? '' : 's'}`
    : `Showing ${paged.from}–${paged.to} of ${paged.total} devices`;

  const renderBody = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      );
    }
    if (error) {
      return (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setTimestamp(Date.now())}>Retry</Button>}>
          {error}
        </Alert>
      );
    }
    if (!rows.length) {
      return (
        <Stack spacing={1.5} alignItems="center" sx={{ py: 6, textAlign: 'center' }}>
          <GpsFixedIcon sx={{ fontSize: 40, ...muted }} />
          <Typography variant="h6" fontWeight={700}>No devices yet</Typography>
          <Typography variant="body2" sx={muted}>
            Register a GPS tracker, then assign it to a vehicle to start tracking.
          </Typography>
          {addButton}
        </Stack>
      );
    }
    return (
      <Stack spacing={2}>
        <Box sx={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
        }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, value) => changeTab(value)}
            variant="scrollable"
            scrollButtons={false}
            TabIndicatorProps={{ sx: { display: 'none' } }}
            sx={{ minHeight: 0, maxWidth: '100%', '& .MuiTabs-flexContainer': { gap: 1 } }}
          >
            {TABS.map((item) => (
              <Tab
                key={item.value}
                value={item.value}
                disableRipple
                disabled={item.value === 'unassigned' && !vehiclesKnown}
                label={<TabLabel tab={item} count={counts[item.value]} />}
                sx={{
                  minHeight: 40,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  '&.Mui-selected': {
                    color: 'var(--color-primary)',
                    backgroundColor: 'var(--color-primary-light)',
                    borderColor: 'var(--color-primary)',
                  },
                }}
              />
            ))}
          </Tabs>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<DownloadIcon />}
              endIcon={<KeyboardArrowDownIcon />}
              onClick={(event) => setExportAnchor(event.currentTarget)}
              disabled={!exportScope.length}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<TuneIcon />}
              endIcon={<KeyboardArrowDownIcon />}
              onClick={(event) => setColumnsAnchor(event.currentTarget)}
            >
              Columns
            </Button>
          </Stack>
        </Box>

        {selected.size > 0 && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderRadius: '10px', backgroundColor: 'var(--color-primary-light)',
          }}
          >
            <Typography variant="body2" fontWeight={600}>{`${selected.size} selected`}</Typography>
            <Button size="small" startIcon={<ClearIcon fontSize="small" />} onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </Box>
        )}

        {filtered.length === 0 ? (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 5, textAlign: 'center' }}>
            <Typography fontWeight={600}>No devices match your filters.</Typography>
            <Button onClick={clearFilters}>Clear filters</Button>
          </Stack>
        ) : list}

        <Box sx={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
        }}
        >
          <Typography variant="body2" sx={muted}>{showingText}</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Pagination
              count={paged.pageCount}
              page={paged.page}
              onChange={(_, value) => setPage(value)}
              shape="rounded"
              color="primary"
              size="small"
            />
            <Select
              size="small"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
              inputProps={{ 'aria-label': 'Devices per page' }}
              MenuProps={{ slotProps: popoverSlotProps }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <MenuItem key={size} value={size}>{`${size} / page`}</MenuItem>
              ))}
            </Select>
          </Stack>
        </Box>
      </Stack>
    );
  };

  return (
    <SettingsCenterShell>
      <SettingsSectionPanel
        title="Devices"
        description="GPS trackers linked to your fleet."
        actions={headerActions}
      >
        {renderBody()}
      </SettingsSectionPanel>

      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
        slotProps={popoverSlotProps}
      >
        <MenuItem disabled dense>
          {selected.size ? `${selected.size} selected device${selected.size === 1 ? '' : 's'}` : `${exportScope.length} device${exportScope.length === 1 ? '' : 's'}`}
        </MenuItem>
        <MenuItem onClick={() => handleExport('xlsx')}>Excel (.xlsx)</MenuItem>
        <MenuItem onClick={() => handleExport('csv')}>CSV (.csv)</MenuItem>
      </Menu>

      <Menu
        anchorEl={columnsAnchor}
        open={Boolean(columnsAnchor)}
        onClose={() => setColumnsAnchor(null)}
        slotProps={popoverSlotProps}
      >
        {COLUMNS.map((column) => (
          <MenuItem
            key={column.key}
            dense
            onClick={() => setColumnPrefs({ ...columnPrefs, [column.key]: !visible[column.key] })}
          >
            <Checkbox size="small" checked={visible[column.key]} tabIndex={-1} disableRipple sx={{ mr: 1, p: 0.5 }} />
            {column.label}
          </MenuItem>
        ))}
      </Menu>

      <RemoveDialog
        style={{ transform: 'none' }}
        open={removeId != null}
        endpoint="devices"
        itemId={removeId}
        onRemove={(id) => deleteFleetDevice(user, id)}
        onResult={(removed) => {
          if (removed) {
            dispatch(devicesActions.remove(removeId));
            setDevices((previous) => previous.filter((device) => device.id !== removeId));
          }
          setRemoveId(null);
        }}
      />
    </SettingsCenterShell>
  );
}
