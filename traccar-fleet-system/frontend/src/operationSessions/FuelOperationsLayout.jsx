import {
  useCallback, useMemo, useRef, useState,
} from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Paper,
  Snackbar,
  Tab,
  Tabs,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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

// The one hard business rule that currently blocks moving forward: fueling
// can't start before a manager approves the day (recordOperationRefuel /
// enrichOperationMeta.canRecordFuel already enforce this on the backend —
// this is purely a UX pre-check so swipe/Next/tab-click don't navigate into
// a page that will just reject the action). Gated on the *target* step, not
// the step being left, so jumping ahead to Review/Invoice/History is
// unaffected — those pages already show their own "nothing yet" messaging.
function forwardBlockMessage(toStepKey, { operation, details }) {
  if (toStepKey !== 'fuel') return null;
  const status = String(
    details?.effectiveStatus || operation?.effectiveStatus || operation?.status || '',
  ).toLowerCase();
  if (status === 'draft') {
    return 'A manager must start the Fueling Day before fueling can begin.';
  }
  return null;
}

const SWIPE_MIN_DISTANCE_PX = 60;
const SWIPE_MAX_OFF_AXIS_PX = 60;

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

  const [blockedMessage, setBlockedMessage] = useState('');
  const [slideKey, setSlideKey] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const touchStartRef = useRef(null);

  // Single navigation authority: swipe, the Tabs bar, and the Previous/Next
  // buttons below all funnel through this so they stay fully synchronized
  // and share the same forward-navigation business-rule gate.
  const goToIndex = useCallback((targetIndex, direction) => {
    if (targetIndex < 0 || targetIndex >= TABS.length || targetIndex === tabIndex) return;
    if (direction > 0) {
      const toKey = TABS[targetIndex].stepKey;
      const message = toKey ? forwardBlockMessage(toKey, { operation: todayOperation, details: todayDetails }) : null;
      if (message) {
        setBlockedMessage(message);
        return;
      }
    }
    setSlideDirection(direction);
    setSlideKey((k) => k + 1);
    navigate(TABS[targetIndex].path);
  }, [tabIndex, todayOperation, todayDetails, navigate]);

  const goNext = useCallback(() => goToIndex(tabIndex + 1, 1), [goToIndex, tabIndex]);
  const goPrev = useCallback(() => goToIndex(tabIndex - 1, -1), [goToIndex, tabIndex]);

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > SWIPE_MAX_OFF_AXIS_PX) return; // vertical scroll, not a swipe
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return; // too short to count
    if (dx < 0) goNext(); else goPrev();
  };

  const path = location.pathname;
  const isTodayRoute = path === '/fleet/operation-sessions';
  const isHistoryRoute = path.startsWith('/fleet/operation-sessions/history');
  const isFuelRoute = path.startsWith('/fleet/operation-sessions/fuel');
  const isPrepareRoute = path.startsWith('/fleet/operation-sessions/prepare');
  const isReviewRoute = path.startsWith('/fleet/operation-sessions/review');
  const isInvoiceRoute = path.startsWith('/fleet/operation-sessions/invoices');
  const showSummary = !isTodayRoute && !isHistoryRoute && !isFuelRoute && !isPrepareRoute
    && !isReviewRoute && !isInvoiceRoute
    && todayOperation?.id && todayDetails;

  const summaryPhase = path.startsWith('/fleet/operation-sessions/invoices')
    ? 'closeout'
    : 'inProgress';

  return (
    <Container maxWidth="lg" disableGutters sx={{ width: '100%', py: RUNTIME_CONTAINER_PY }}>
      <FleetWorkspaceShell>
        <Tabs
          value={tabIndex}
          onChange={(_, idx) => goToIndex(idx, idx > tabIndex ? 1 : -1)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            mb: showSummary ? 1.5 : 2,
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: { xs: 40, sm: 48 },
            '& .MuiTabs-scrollButtons': { width: { xs: 24, sm: 40 } },
          }}
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
                minHeight: { xs: 40, sm: 48 },
                minWidth: { xs: 62, sm: 90 },
                px: { xs: 0.75, sm: 2 },
                fontSize: { xs: '0.7rem', sm: '0.875rem' },
                whiteSpace: 'nowrap',
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

        <Box
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          sx={{ overflow: 'hidden' }}
        >
          <Box
            key={slideKey}
            sx={{
              '@keyframes slideInFromRight': {
                from: { transform: 'translateX(24px)', opacity: 0 },
                to: { transform: 'translateX(0)', opacity: 1 },
              },
              '@keyframes slideInFromLeft': {
                from: { transform: 'translateX(-24px)', opacity: 0 },
                to: { transform: 'translateX(0)', opacity: 1 },
              },
              animation: `${slideDirection > 0 ? 'slideInFromRight' : 'slideInFromLeft'} 0.22s ease-out`,
            }}
          >
            <Outlet />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Button
            size="small"
            startIcon={<ChevronLeftIcon />}
            onClick={goPrev}
            disabled={tabIndex === 0}
            sx={{ textTransform: 'none' }}
          >
            Previous
          </Button>
          <Button
            size="small"
            endIcon={<ChevronRightIcon />}
            onClick={goNext}
            disabled={tabIndex === TABS.length - 1}
            sx={{ textTransform: 'none' }}
          >
            Next
          </Button>
        </Box>
      </FleetWorkspaceShell>

      <Snackbar
        open={Boolean(blockedMessage)}
        autoHideDuration={3500}
        onClose={() => setBlockedMessage('')}
        message={blockedMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}
