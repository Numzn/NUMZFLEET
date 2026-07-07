import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Tab,
  Tabs,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import { RUNTIME_CONTAINER_PY } from '../common/styles/runtimeDensity';
import { useSetTopBarTitle } from '../common/components/TopBarTitleContext';
import { deriveOperationSteps } from './utils/operationDayUtils.js';
import useTodayOperation from './hooks/useTodayOperation.js';
import OperationDaySummary from './components/OperationDaySummary.jsx';

// Visual order matches the requested product flow (Plan -> Fueling -> Review -> Invoice ->
// History). Note: the underlying step-completion logic in deriveOperationSteps() still
// treats "invoice" as a prerequisite for "review" being marked active/done (see
// operationDayUtils.js) — that dependency is unchanged here; only display order and
// labels moved. No route paths changed.
const TABS = [
  { label: 'Plan', path: '/fleet/operation-sessions/prepare', stepKey: 'prepare', match: (path) => path.startsWith('/fleet/operation-sessions/prepare') },
  { label: 'Fueling', path: '/fleet/operation-sessions/fuel', stepKey: 'fuel', match: (path) => path.startsWith('/fleet/operation-sessions/fuel') },
  { label: 'Review', path: '/fleet/operation-sessions/review', stepKey: 'review', match: (path) => path.startsWith('/fleet/operation-sessions/review') },
  { label: 'Invoice', path: '/fleet/operation-sessions/invoices', stepKey: 'invoice', match: (path) => path.startsWith('/fleet/operation-sessions/invoices') },
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
  const { todayOperation, todayDetails } = useTodayOperation();
  useSetTopBarTitle('Fueling Day');
  const steps = useMemo(
    () => deriveOperationSteps({ operation: todayOperation, details: todayDetails }),
    [todayOperation, todayDetails],
  );

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
