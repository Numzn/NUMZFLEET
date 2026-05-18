import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import {
  RUNTIME_CONTAINER_PY,
  RUNTIME_STACK_GAP,
} from '../common/styles/runtimeDensity';
import {
  closeOperationSession,
  fetchOperationSessionDetails,
  fetchOperationSessions,
} from './api/operationSessionsApi';
import { operationSessionsActions } from './store/operationSessions';

function formatK(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `K ${v.toFixed(0)}`;
}

function formatL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${v.toFixed(1)} L`;
}

const OperationSessionsPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeDetails, setActiveDetails] = useState(null);
  const [search, setSearch] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');

  const activeSession = useMemo(
    () => sessions.find((s) => String(s.status).toLowerCase() === 'active'),
    [sessions],
  );

  const reloadAllSessions = useCallback(async () => {
    if (!user) return [];
    const data = await fetchOperationSessions(user);
    const list = Array.isArray(data) ? data : [];
    setSessions(list);
    dispatch(operationSessionsActions.refresh(list));
    return list;
  }, [dispatch, user]);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const list = await reloadAllSessions();
        const active = list.find((s) => String(s.status).toLowerCase() === 'active');
        if (active) {
          const details = await fetchOperationSessionDetails(user, active.id);
          setActiveDetails(details);
          dispatch(operationSessionsActions.upsertDetails({ sessionId: active.id, data: details }));
          dispatch(operationSessionsActions.setCurrentSession(active.id));
        } else {
          setActiveDetails(null);
          dispatch(operationSessionsActions.setCurrentSession(null));
        }
      } catch (requestError) {
        setError(requestError.message || 'Failed to load operation sessions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dispatch, user, reloadAllSessions]);

  const refuels = activeDetails?.refuels || [];
  const vehicleTotal = refuels.length;
  const completedCount = useMemo(
    () => refuels.filter((r) => r.actualFuelLitres != null && Number(r.actualFuelLitres) > 0).length,
    [refuels],
  );
  const pendingCount = Math.max(0, vehicleTotal - completedCount);

  const plannedTotalL = useMemo(
    () => refuels.reduce((acc, r) => {
      const p = r.plannedFuelLitres != null ? Number(r.plannedFuelLitres) : null;
      if (p != null && Number.isFinite(p) && p > 0) return acc + p;
      const e = r.estimatedFuelLitres != null ? Number(r.estimatedFuelLitres) : 0;
      return acc + (Number.isFinite(e) ? e : 0);
    }, 0),
    [refuels],
  );

  const actualTotalL = Number(activeDetails?.totalActualFuel ?? activeSession?.totalActualFuel ?? 0);
  const varianceL = actualTotalL - plannedTotalL;

  const recentClosed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions
      .filter((s) => String(s.status).toLowerCase() === 'closed')
      .filter((s) => {
        if (!q) return true;
        const idStr = String(s.id);
        const name = (s.name || '').toLowerCase();
        const dateStr = s.sessionDate ? new Date(s.sessionDate).toLocaleString().toLowerCase() : '';
        return idStr.includes(q) || name.includes(q) || dateStr.includes(q);
      })
      .slice(0, 50);
  }, [sessions, search]);

  const confirmClose = async () => {
    if (!user || !activeSession) return;
    setClosing(true);
    setCloseError('');
    try {
      await closeOperationSession(user, activeSession.id);
      setCloseOpen(false);
      setActiveDetails(null);
      dispatch(operationSessionsActions.setCurrentSession(null));
      await reloadAllSessions();
    } catch (err) {
      setCloseError(err.message || 'Failed to close session');
    } finally {
      setClosing(false);
    }
  };

  return (
    <>
      <Container maxWidth={false} disableGutters sx={{ width: '100%', py: RUNTIME_CONTAINER_PY }}>
        <FleetWorkspaceShell>
          <Stack spacing={RUNTIME_STACK_GAP}>

            {error && <Alert severity="error">{error}</Alert>}

            {loading ? (
              <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {activeSession && !activeDetails && !loading && (
                  <Alert
                    severity="warning"
                    action={(
                      <Button color="inherit" size="small" onClick={() => navigate(`/fleet/operation-sessions/run/${activeSession.id}`)}>
                        Open run
                      </Button>
                    )}
                  >
                    Active session loaded from list, but details failed to refresh. You can still resume from the run screen.
                  </Alert>
                )}

                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  {activeSession && activeDetails ? (
                    <Stack spacing={0.75}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" fontWeight={800}>
                          {activeDetails.name || `Session ${activeSession.id}`}
                        </Typography>
                        <Chip label="ACTIVE" color="success" size="small" />
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        <Chip size="small" label={`✓ ${completedCount}/${vehicleTotal} done`} />
                        <Chip size="small" variant="outlined" label={`Pending ${pendingCount}`} />
                        <Chip size="small" variant="outlined" label={`${formatL(activeDetails.totalActualFuel)} dispensed`} />
                        <Chip size="small" variant="outlined" label={`${formatK(activeDetails.totalActualCost)} cost`} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => navigate(`/fleet/operation-sessions/run/${activeSession.id}`)}
                        >
                          Resume
                        </Button>
                        <Button
                          variant="outlined"
                          color="warning"
                          size="small"
                          onClick={() => setCloseOpen(true)}
                        >
                          Close
                        </Button>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => navigate('/fleet/operation-sessions/create')}
                        >
                          New
                        </Button>
                      </Box>
                    </Stack>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" color="text.secondary" fontWeight={700}>
                        No active session
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate('/fleet/operation-sessions/create')}
                      >
                        Create session
                      </Button>
                    </Box>
                  )}
                </Paper>

                <Box>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
                    Recent sessions
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search by name, id, or date…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ mb: 0.5 }}
                  />
                  <Paper variant="outlined">
                    <List disablePadding>
                      {recentClosed.length === 0 && (
                        <ListItemButton disabled>
                          <ListItemText primary="No closed sessions match your search." />
                        </ListItemButton>
                      )}
                      {recentClosed.map((s) => (
                        <ListItemButton
                          key={s.id}
                          onClick={() => navigate(`/fleet/operation-sessions/run/${s.id}`)}
                        >
                          <ListItemText
                            primary={s.name || `Session ${s.id}`}
                            secondary={
                              <>
                                {s.sessionDate ? new Date(s.sessionDate).toLocaleString() : ''}
                                {' · '}
                                {formatL(s.totalActualFuel)}
                                {' · '}
                                {formatK(s.totalActualCost)}
                              </>
                            }
                          />
                          <Chip label="Closed" size="small" />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                </Box>
              </>
            )}
          </Stack>
        </FleetWorkspaceShell>
      </Container>

      <Dialog open={closeOpen} onClose={() => !closing && setCloseOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Close session?</DialogTitle>
        <DialogContent>
          {closeError && <Alert severity="error" sx={{ mb: 1 }}>{closeError}</Alert>}
          <Stack spacing={0.5}>
            <Typography variant="body2">
              <strong>Planned total:</strong>
              {' '}
              {formatL(plannedTotalL)}
            </Typography>
            <Typography variant="body2">
              <strong>Actual total:</strong>
              {' '}
              {formatL(actualTotalL)}
            </Typography>
            <Typography variant="body2">
              <strong>Variance:</strong>
              {' '}
              {varianceL >= 0 ? '+' : ''}
              {varianceL.toFixed(1)}
              {' '}
              L
            </Typography>
            <Typography variant="body2">
              <strong>Vehicles fueled:</strong>
              {' '}
              {completedCount}
              {' '}
              /
              {' '}
              {vehicleTotal}
            </Typography>
            <Typography variant="body2">
              <strong>Total cost:</strong>
              {' '}
              {formatK(activeDetails?.totalActualCost)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
              Refuel lines will be locked and totals frozen. This cannot be undone from the app.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseOpen(false)} disabled={closing}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={confirmClose} disabled={closing}>
            {closing ? 'Closing…' : 'Confirm close'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OperationSessionsPage;
