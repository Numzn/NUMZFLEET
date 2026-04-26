import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AppLayout from '../common/components/AppLayout';
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

const OperationSessionsPage = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);
  const vehicles = useSelector((state) => Object.values(state.devices.items || {}));
  const sessionsMap = useSelector((state) => state.operationSessions.items);
  const detailsMap = useSelector((state) => state.operationSessions.details);
  const currentSessionId = useSelector((state) => state.operationSessions.currentSessionId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const sessions = useMemo(() => Object.values(sessionsMap || {}), [sessionsMap]);
  const currentSession = currentSessionId ? detailsMap[currentSessionId] : null;
  const currentRefuels = currentSession?.refuels || [];

  const vehiclesByBudget = useMemo(() => buildVehicleBudgetIndex(vehicles), [vehicles]);
  const summarizedSessions = useMemo(
    () => summarizeSessions(currentRefuels, vehiclesByBudget),
    [currentRefuels, vehiclesByBudget],
  );
  const fleetEfficiency = useMemo(() => calculateFleetEfficiency(currentRefuels), [currentRefuels]);

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
        const firstSessionId = data?.[0]?.id || null;
        if (firstSessionId) {
          await loadSessionDetails(firstSessionId);
        }
      } catch (requestError) {
        setError(requestError.message || 'Failed to load operation sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [dispatch, user, reloadAllSessions, loadSessionDetails]);

  const handleNewSession = async () => {
    if (!user) return;
    setCreating(true);
    setCreateError(null);
    try {
      const newSession = await createOperationSession(user, {
        name: `Fuel Session ${new Date().toLocaleDateString()}`,
        sessionDate: new Date(),
        notes: '',
      });
      const data = await reloadAllSessions();
      await loadSessionDetails(newSession.id);
    } catch (err) {
      setCreateError(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
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
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h4">Operation Sessions</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewSession}
              disabled={creating || !user}
            >
              {creating ? 'Creating...' : 'New Session'}
            </Button>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
          {createError && <Alert severity="error" onClose={() => setCreateError(null)}>{createError}</Alert>}

          {loading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {sessions.length === 0 && (
                <Alert severity="info">No sessions yet. Click "New Session" to start logging refuels.</Alert>
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
      </Container>
    </AppLayout>
  );
};

export default OperationSessionsPage;
