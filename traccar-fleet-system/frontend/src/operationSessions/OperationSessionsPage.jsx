import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AppLayout from '../common/components/AppLayout';
import Breadcrumbs from '../common/components/Breadcrumbs';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import SessionSummary from './components/SessionSummary';
import SessionStats from './components/SessionStats';
import RefuelTable from './components/RefuelTable';
import {
  createOperationSession,
  fetchOperationSessionDetails,
  fetchOperationSessions,
} from './api/operationSessionsApi';
import { operationSessionsActions } from './store/operationSessions';
import { buildVehicleBudgetIndex, calculateFleetEfficiency } from './utils/sessionCalculations';
import { summarizeSessions } from './utils/sessionGrouping';
import { collectDeviceIdsForQuickStart } from './utils/operationVehicleContext';

const OperationSessionsPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);
  const devicesItems = useSelector((state) => state.devices.items || {});
  const vehicles = useSelector((state) => Object.values(state.devices.items || {}));
  const sessionsMap = useSelector((state) => state.operationSessions.items);
  const detailsMap = useSelector((state) => state.operationSessions.details);
  const currentSessionId = useSelector((state) => state.operationSessions.currentSessionId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quickStarting, setQuickStarting] = useState(false);
  const [quickStartMessage, setQuickStartMessage] = useState(null);

  const sessions = useMemo(() => Object.values(sessionsMap || {}), [sessionsMap]);
  const activeSession = useMemo(
    () => sessions.find((s) => String(s.status).toLowerCase() === 'active'),
    [sessions],
  );
  const resumeSessionId = activeSession?.id ?? null;

  const currentSession = currentSessionId ? detailsMap[currentSessionId] : null;
  const currentRefuels = currentSession?.refuels || [];

  const vehiclesByBudget = useMemo(() => buildVehicleBudgetIndex(vehicles), [vehicles]);
  const summarizedSessions = useMemo(
    () => summarizeSessions(currentRefuels, vehiclesByBudget),
    [currentRefuels, vehiclesByBudget],
  );
  const fleetEfficiency = useMemo(() => calculateFleetEfficiency(currentRefuels), [currentRefuels]);

  const quickStartIds = useMemo(() => collectDeviceIdsForQuickStart(devicesItems), [devicesItems]);

  const loadSessionDetails = useCallback(async (sessionId) => {
    if (!user || !sessionId) return;
    const details = await fetchOperationSessionDetails(user, sessionId);
    dispatch(operationSessionsActions.upsertDetails({ sessionId, data: details }));
    dispatch(operationSessionsActions.setCurrentSession(sessionId));
  }, [dispatch, user]);

  const reloadAllSessions = useCallback(async () => {
    if (!user) return;
    const data = await fetchOperationSessions(user);
    dispatch(operationSessionsActions.refresh(Array.isArray(data) ? data : []));
    return data;
  }, [dispatch, user]);

  useEffect(() => {
    const loadSessions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await reloadAllSessions();
        const list = Array.isArray(data) ? data : [];
        const active = list.find((s) => String(s.status).toLowerCase() === 'active');
        const pickId = active?.id ?? list[0]?.id ?? null;
        if (pickId) {
          await loadSessionDetails(pickId);
        }
      } catch (requestError) {
        setError(requestError.message || 'Failed to load operation sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [dispatch, user, reloadAllSessions, loadSessionDetails]);

  const handleQuickStart = async () => {
    if (!user || resumeSessionId) return;
    setQuickStartMessage(null);
    if (!quickStartIds.length) {
      setQuickStartMessage('No vehicles loaded yet. Open the map or device list so Traccar devices sync, then try again.');
      return;
    }
    setQuickStarting(true);
    setError(null);
    try {
      const created = await createOperationSession(user, {
        name: `Quick operation ${new Date().toLocaleString()}`,
        sessionDate: new Date(),
        notes: '',
        vehicleIds: quickStartIds,
      });
      await reloadAllSessions();
      dispatch(operationSessionsActions.setCurrentSession(created.id));
      navigate(`/fleet/operation-sessions/run/${created.id}`);
    } catch (err) {
      const msg = err?.message || 'Could not start operation';
      if (/409|Close the current active session/i.test(msg)) {
        setQuickStartMessage('You already have an active session — use Resume active session or close it first.');
      } else {
        setQuickStartMessage(msg);
      }
    } finally {
      setQuickStarting(false);
    }
  };

  const handleRefuelSubmitted = useCallback(async () => {
    if (currentSessionId) {
      await loadSessionDetails(currentSessionId);
    }
  }, [currentSessionId, loadSessionDetails]);

  const handleSessionClosed = useCallback(async (sessionId) => {
    await reloadAllSessions();
    await loadSessionDetails(sessionId);
  }, [reloadAllSessions, loadSessionDetails]);

  return (
    <AppLayout showSidebar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Breadcrumbs />
        <FleetWorkspaceShell>
          <Stack spacing={2}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Box>
              <Typography variant="h4">Operations</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Start, plan, or resume operations.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {resumeSessionId && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate(`/fleet/operation-sessions/run/${resumeSessionId}`)}
                >
                  Resume active session
                </Button>
              )}
              <Tooltip
                title={
                  resumeSessionId
                    ? 'Close or finish the active session before starting another.'
                    : ''
                }
              >
                <span>
                  <Button
                    variant={resumeSessionId ? 'outlined' : 'contained'}
                    color="secondary"
                    onClick={handleQuickStart}
                    disabled={Boolean(resumeSessionId) || quickStarting || !user}
                  >
                    {quickStarting ? 'Starting…' : 'Start operation'}
                  </Button>
                </span>
              </Tooltip>
              <Button
                variant="outlined"
                onClick={() => navigate('/fleet/operation-sessions/plan')}
              >
                Plan operation
              </Button>
              <Button variant="outlined" onClick={() => navigate('/fleet/operation-sessions/history')}>
                History
              </Button>
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {quickStartMessage && (
            <Alert severity="warning" onClose={() => setQuickStartMessage(null)}>
              {quickStartMessage}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {!sessions.length && (
                <Alert severity="info">
                  No sessions yet. Start an operation or create a plan.
                </Alert>
              )}
              {!quickStartIds.length && (
                <Alert severity="info">
                  No devices loaded. Open Live Map or refresh devices, then try again.
                </Alert>
              )}
              {resumeSessionId && (
                <Alert severity="info" sx={{ py: 0.75 }}>
                  Session #{resumeSessionId} is active. Resume it or close it before starting a new one.
                </Alert>
              )}
              <SessionStats sessions={summarizedSessions} fleetEfficiency={fleetEfficiency} />
              <SessionSummary
                sessions={sessions}
                selectedSessionId={currentSessionId}
                onSelectSession={loadSessionDetails}
                onSessionClosed={handleSessionClosed}
              />
              <RefuelTable
                sessionId={currentSessionId}
                sessionStatus={currentSession?.status}
                vehicles={vehicles}
                selectedVehicleIds={[]}
                onSubmitted={handleRefuelSubmitted}
              />
            </>
          )}
        </Stack>
        </FleetWorkspaceShell>
      </Container>
    </AppLayout>
  );
};

export default OperationSessionsPage;
