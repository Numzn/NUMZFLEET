import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import { RUNTIME_CONTAINER_PY } from '../common/styles/runtimeDensity';
import {
  deriveOperationSteps,
  formatLockCountdown,
  getTodayKeyInTimeZone,
} from './utils/operationDayUtils.js';
import useTodayOperation from './hooks/useTodayOperation.js';
import OperationDaySummary from './components/OperationDaySummary.jsx';

const TABS = [
  { label: 'Overview', path: '/fleet/operation-sessions', stepKey: null, match: (path) => path === '/fleet/operation-sessions' },
  { label: 'Plan', path: '/fleet/operation-sessions/prepare', stepKey: 'prepare', match: (path) => path.startsWith('/fleet/operation-sessions/prepare') },
  { label: 'Fuel', path: '/fleet/operation-sessions/fuel', stepKey: 'fuel', match: (path) => path.startsWith('/fleet/operation-sessions/fuel') },
  { label: 'Invoices', path: '/fleet/operation-sessions/invoices', stepKey: 'invoice', match: (path) => path.startsWith('/fleet/operation-sessions/invoices') },
  { label: 'Close Day', path: '/fleet/operation-sessions/review', stepKey: 'review', match: (path) => path.startsWith('/fleet/operation-sessions/review') },
  { label: 'History', path: '/fleet/operation-sessions/history', stepKey: null, match: (path) => path.startsWith('/fleet/operation-sessions/history') },
];

function TabLabel({ label, stepState }) {
  if (!stepState) return label;
  if (stepState.done) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <CheckIcon sx={{ fontSize: '0.85rem', color: 'success.main' }} />
        {label}
      </Box>
    );
  }
  return label;
}

export default function FuelOperationsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    todayOperation, todayDetails, fleetTimezone, loading: todayLoading,
  } = useTodayOperation();
  const todayKey = useMemo(() => getTodayKeyInTimeZone(fleetTimezone), [fleetTimezone]);
  const steps = useMemo(
    () => deriveOperationSteps({ operation: todayOperation, details: todayDetails }),
    [todayOperation, todayDetails],
  );
  const lockCountdown = useMemo(() => {
    const status = String(
      todayDetails?.effectiveStatus || todayOperation?.effectiveStatus || todayOperation?.status || '',
    ).toLowerCase();
    if (status !== 'approved') return null;
    return formatLockCountdown(todayDetails?.locksAt || todayOperation?.locksAt);
  }, [todayDetails, todayOperation]);

  const tabIndex = Math.max(
    0,
    TABS.findIndex((tab) => tab.match(location.pathname)),
  );

  const path = location.pathname;
  const isTodayRoute = path === '/fleet/operation-sessions';
  const isHistoryRoute = path.startsWith('/fleet/operation-sessions/history');
  const isFuelRoute = path.startsWith('/fleet/operation-sessions/fuel');
  const isPrepareRoute = path.startsWith('/fleet/operation-sessions/prepare');
  const showSummary = !isTodayRoute && !isHistoryRoute && !isFuelRoute && !isPrepareRoute
    && todayOperation?.id && todayDetails;

  const summaryPhase = path.startsWith('/fleet/operation-sessions/review')
    || path.startsWith('/fleet/operation-sessions/invoices')
    ? 'closeout'
    : 'inProgress';

  return (
    <Container maxWidth="lg" disableGutters sx={{ width: '100%', py: RUNTIME_CONTAINER_PY }}>
      <FleetWorkspaceShell>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 0.25 }}>Fueling Day</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {todayKey}
              {fleetTimezone ? ` · ${fleetTimezone}` : ''}
            </Typography>
            {(todayDetails?.reference || todayOperation?.reference) ? (
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                {todayDetails?.reference || todayOperation?.reference}
              </Typography>
            ) : null}
            {lockCountdown ? (
              <Typography variant="body2" color="warning.main" fontWeight={600}>
                {lockCountdown}
              </Typography>
            ) : null}
          </Box>
        </Box>

        <Tabs
          value={tabIndex}
          onChange={(_, idx) => navigate(TABS[idx].path)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: showSummary ? 1.5 : 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.path}
              label={(
                <TabLabel
                  label={tab.label}
                  stepState={tab.stepKey ? steps?.[tab.stepKey] : null}
                />
              )}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                ...(tab.stepKey && steps?.[tab.stepKey]?.active ? { color: 'primary.main' } : {}),
              }}
            />
          ))}
        </Tabs>

        {showSummary && (
          <Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2 }}>
            <OperationDaySummary
              operation={todayOperation}
              details={todayDetails}
              variant="compact"
              phase={summaryPhase}
            />
          </Paper>
        )}

        <Outlet />
      </FleetWorkspaceShell>
    </Container>
  );
}
