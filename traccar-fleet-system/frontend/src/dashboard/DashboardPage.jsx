import { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import FleetStatusRow from './components/FleetStatusRow';
import NeedsAttentionList from './components/NeedsAttentionList';
import TodayOperationsCard from './components/TodayOperationsCard';
import LiveFleetList from './components/LiveFleetList';
import ErbPricesCard from './components/ErbPricesCard';
import useFilter from '../main/useFilter';
import usePersistedState from '../common/util/usePersistedState';
import { fuelApiAuthHeaders } from '../config/fuelApiAuth.js';
import { useManager } from '../common/util/permissions';
import useTodayOperation from '../operationSessions/hooks/useTodayOperation';
import { isPendingFuelStatus } from '../fuelRequests/fuelRequestStatus';
import { useVehicleDisplayContext } from '../fleet/display/VehicleDisplayRegistryContext';
import { fetchMaintenanceDashboard } from '../maintenance/maintenanceApi.js';
import getOperationalIndicators from '../main/fleet/vehicleOperationalIndicators.js';
import { resolveLiveActivityState } from '../fleet/vehicleDetail/resolveLiveActivityState.js';

const SECTION_LABEL_SX = {
  fontWeight: 800,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  mb: 1,
};

const DashboardPage = () => {
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const isManager = useManager();
  const positions = useSelector((state) => state.session.positions);
  const events = useSelector((state) => state.events.items);
  const fuelRequests = useSelector((state) => state.fuelRequests?.items || {});
  const user = useSelector((state) => state.session.user);
  const [commandCenter, setCommandCenter] = useState(null);
  const [maintenanceDashboard, setMaintenanceDashboard] = useState(null);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);

  const { todayOperation, todayDetails } = useTodayOperation();
  const [keyword] = useState('');
  const [filter] = usePersistedState('filter', {
    statuses: [],
    groups: [],
  });
  const [filterSort] = usePersistedState('filterSort', '');
  const [filterMap] = usePersistedState('filterMap', false);
  const { getDisplayForDevice } = useVehicleDisplayContext();

  useFilter(keyword, filter, filterSort, filterMap, positions, setFilteredDevices, setFilteredPositions);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    fetch('/api/fleet/command-center', {
      headers: fuelApiAuthHeaders(user),
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setCommandCenter(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // Service-due counts for Needs Attention — manager-only endpoint; silently
  // omit the category for non-managers rather than erroring the page.
  useEffect(() => {
    if (!user || !isManager) return undefined;
    let cancelled = false;
    fetchMaintenanceDashboard(user)
      .then((data) => {
        if (!cancelled) setMaintenanceDashboard(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, isManager]);

  useEffect(() => {
    const h = (location.hash || '').replace(/^#/, '');
    if (h !== 'dashboard-erb') return;
    const el = document.getElementById('dashboard-erb');
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash]);

  // One pass per device: state is computed live from Redux (Traccar's own
  // WebSocket feed — real-time, available to every authenticated user), not
  // from the persisted `activityState` registry, which is manager-gated and
  // only refreshed when a manager's browser happens to call GET /api/vehicles
  // (no background job re-evaluates it). Confirmed in production: a vehicle
  // moving right now still showed "idle" from a persisted row over 2 days
  // stale. The persisted record is kept only as duration context, and only
  // trusted when it agrees with the live-computed state (see liveState
  // reconciliation below) — never trusted for moving/idle/offline itself.
  const vehicleRows = useMemo(() => filteredDevices.map((device) => {
    const display = getDisplayForDevice(device.id, device);
    const position = positions[device.id];
    const state = resolveLiveActivityState({
      deviceStatus: device.status,
      deviceLastUpdate: device.lastUpdate,
      positionSpeed: position?.speed != null ? Number(position.speed) : null,
    });
    const hasAlarm = Object.values(events).some((event) => (
      (event.type === 'alarm' || event.type === 'panic') && Number(event.deviceId) === Number(device.id)
    ));
    const indicators = getOperationalIndicators(device, position);
    const hasProblem = hasAlarm || indicators.some((indicator) => indicator.color === 'error');
    // Persisted stateEnteredAt is only meaningful (and only shown) when the
    // persisted state still agrees with what's live right now — otherwise
    // the transition just happened and we don't know when, so show nothing
    // rather than a stale duration paired with a corrected live state.
    const persistedState = display.activityState;
    const activityState = persistedState?.state === state ? persistedState : null;
    return {
      device, position, display, state, hasProblem, activityState,
    };
  }), [filteredDevices, positions, getDisplayForDevice, events]);

  const fleetStatus = useMemo(() => {
    const total = vehicleRows.length;
    const online = vehicleRows.filter((v) => v.state !== 'offline').length;
    const moving = vehicleRows.filter((v) => v.state === 'moving').length;
    return { total, online, moving, offline: Math.max(total - online, 0) };
  }, [vehicleRows]);

  const urgentAlerts = useMemo(() => Object.values(events).filter((event) => (
    event.type === 'alarm' || event.type === 'panic'
  )).length, [events]);

  const pendingFuelRequests = useMemo(() => {
    const live = Object.values(fuelRequests).filter((request) => isPendingFuelStatus(request.status)).length;
    return commandCenter?.pendingFuelRequests ?? live;
  }, [fuelRequests, commandCenter]);

  const serviceDue = useMemo(() => {
    const kpis = maintenanceDashboard?.kpis;
    if (!kpis) return 0;
    return Number(kpis.overdue || 0) + Number(kpis.dueToday || 0);
  }, [maintenanceDashboard]);

  // Severity-ordered, zero-value categories dropped — the only categories
  // this screen ever shows are ones that warrant a click.
  const attentionItems = useMemo(() => {
    const items = [];
    if (urgentAlerts > 0) {
      items.push({
        key: 'alerts',
        label: 'Urgent alerts',
        value: urgentAlerts,
        tone: theme.palette.error.main,
        icon: <WarningAmberRoundedIcon sx={{ fontSize: '1rem' }} />,
        onClick: () => navigate('/map'),
      });
    }
    if (fleetStatus.offline > 0) {
      items.push({
        key: 'offline',
        label: 'Trackers offline',
        value: fleetStatus.offline,
        tone: theme.palette.warning.main,
        icon: <DirectionsCarFilledOutlinedIcon sx={{ fontSize: '1rem' }} />,
        onClick: () => navigate('/map'),
      });
    }
    if (serviceDue > 0) {
      items.push({
        key: 'service',
        label: 'Service due',
        value: serviceDue,
        tone: theme.palette.warning.main,
        icon: <BuildOutlinedIcon sx={{ fontSize: '1rem' }} />,
        onClick: () => navigate('/maintenance'),
      });
    }
    if (pendingFuelRequests > 0) {
      items.push({
        key: 'fuel',
        label: 'Fuel approvals waiting',
        value: pendingFuelRequests,
        tone: theme.palette.info.main,
        icon: <LocalGasStationOutlinedIcon sx={{ fontSize: '1rem' }} />,
        onClick: () => navigate('/fuel-requests'),
      });
    }
    return items;
  }, [urgentAlerts, fleetStatus.offline, serviceDue, pendingFuelRequests, theme, navigate]);

  // Live Fleet ordering: problems first, then moving, then recently-idle
  // ("recently active"), then offline ("parked") — most-recent state change
  // first within a tier so the list favors what's likely still relevant.
  const liveFleetRows = useMemo(() => {
    const tier = (row) => {
      if (row.hasProblem) return 0;
      if (row.state === 'moving') return 1;
      if (row.state === 'idle') return 2;
      return 3;
    };
    return [...vehicleRows]
      .sort((a, b) => {
        const diff = tier(a) - tier(b);
        if (diff !== 0) return diff;
        const at = a.activityState?.stateEnteredAt ? new Date(a.activityState.stateEnteredAt).getTime() : 0;
        const bt = b.activityState?.stateEnteredAt ? new Date(b.activityState.stateEnteredAt).getTime() : 0;
        return bt - at;
      })
      .slice(0, 5);
  }, [vehicleRows]);

  const handleFuelQueueJump = () => navigate('/fuel-requests');

  return (
      <Box sx={{
        // Shell renders the dashboard full-bleed (no main gutter); the page owns
        // its own inner inset so content doesn't sit flush against the screen edge.
        px: { xs: 1.5, sm: 2 },
        py: { xs: 1.25, sm: 1.5, md: 2 },
        pb: 'calc(var(--app-bottomnav-height, 0px) + env(safe-area-inset-bottom, 0px) + 28px)',
        // Was a hand-tuned teal-tinted gradient, independently light/dark
        // branched — the one page in the app that painted its own background
        // instead of inheriting the shell's, which is why it read as a
        // different theme from every other screen. var(--surface-app) is the
        // exact color every other page already sits on.
        backgroundColor: 'var(--surface-app)',
        minHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Compact hero: title + primary actions only — status/alerts live in the sections below, not duplicated here.
            Used to be a hand-painted navy-to-teal gradient (duplicated verbatim in ErbPricesCard.jsx) with hardcoded
            near-white text and one-off button gradients built to work against that dark background specifically.
            Now a plain card like every other surface in the app, so the standard button styles from
            common/theme/components.js apply instead of a bespoke pair invented for this one banner. */}
        <Box
          sx={{
            mb: 2.5,
            p: { xs: 1.5, sm: 2 },
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--surface-border)',
            backgroundColor: 'var(--surface-card)',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Typography sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' }, fontWeight: 800, color: 'text.primary' }}>
              Fleet Dashboard
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate('/map')}
                startIcon={<MapOutlinedIcon />}
              >
                Live map
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleFuelQueueJump}
                startIcon={<LocalGasStationOutlinedIcon />}
              >
                Fuel queue
              </Button>
            </Stack>
          </Stack>
        </Box>

        {/* 1. Fleet Status */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={SECTION_LABEL_SX}>Fleet Status</Typography>
          <FleetStatusRow online={fleetStatus.online} moving={fleetStatus.moving} offline={fleetStatus.offline} />
        </Box>

        {/* 2. Needs Attention */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={SECTION_LABEL_SX}>Needs Attention</Typography>
          <NeedsAttentionList items={attentionItems} />
        </Box>

        {/* 3. Today's Operations */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={SECTION_LABEL_SX}>Today&apos;s Operations</Typography>
          <TodayOperationsCard todayOperation={todayOperation} todayDetails={todayDetails} />
        </Box>

        {/* 4. Live Fleet */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={SECTION_LABEL_SX}>Live Fleet</Typography>
          <LiveFleetList rows={liveFleetRows} />
        </Box>

        {/* 5. Fuel Prices */}
        <Box id="dashboard-erb" sx={{ mb: 1, scrollMarginTop: 96 }}>
          <ErbPricesCard />
        </Box>

      </Box>
  );
};

export default DashboardPage;
