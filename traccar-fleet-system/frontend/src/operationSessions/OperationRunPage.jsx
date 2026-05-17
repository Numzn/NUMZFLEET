import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import {
  RUNTIME_CONTAINER_PY,
  RUNTIME_STACK_GAP_TIGHT,
} from '../common/styles/runtimeDensity';
import DriverValue from '../common/components/DriverValue';
import {
  closeOperationSession,
  fetchOperationSessionDetails,
  submitSessionRefuelUpdates,
} from './api/operationSessionsApi';

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

function formatPricePerL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `K ${v.toFixed(2)}/L`;
}

function isPendingRow(r) {
  return r.actualFuelLitres == null || Number(r.actualFuelLitres) <= 0;
}

function varianceTone(planned, actual) {
  const p = Number(planned);
  const a = Number(actual);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(a)) return 'default';
  const pct = Math.abs(((a - p) / p) * 100);
  if (pct < 5) return 'success';
  if (pct < 10) return 'warning';
  return 'error';
}

const PendingRefuelCard = ({
  refuel,
  device,
  disabled,
  onDone,
}) => {
  const [litres, setLitres] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const planned = refuel.plannedFuelLitres != null ? Number(refuel.plannedFuelLitres) : (refuel.estimatedFuelLitres != null ? Number(refuel.estimatedFuelLitres) : null);
  const price = refuel.erbPricePerLitre != null ? Number(refuel.erbPricePerLitre) : null;
  const parsed = Number(litres);
  const hasDraft = Number.isFinite(parsed) && parsed > 0;
  const diff = hasDraft && planned != null && Number.isFinite(planned) ? parsed - planned : null;
  const estCost = hasDraft && price != null ? parsed * price : null;

  const driverId = device?.attributes?.driverUniqueId;

  const handleDone = async () => {
    if (!hasDraft) {
      setLocalError('Enter litres dispensed.');
      return;
    }
    setLocalError('');
    setSaving(true);
    try {
      await onDone({ refuelId: refuel.id, actualFuelLitres: parsed });
      setLitres('');
    } catch (e) {
      setLocalError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 1.25,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} component="div">
              {device?.name || `Vehicle ${refuel.vehicleId}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Driver:
              {' '}
              {driverId ? <DriverValue driverUniqueId={driverId} /> : '—'}
            </Typography>
          </Box>
          <Chip size="small" label="Pending" color="warning" variant="outlined" />
        </Box>

        <Typography variant="body2">
          Planned:
          {' '}
          <strong>{planned != null && Number.isFinite(planned) ? `${planned} L` : '—'}</strong>
        </Typography>

        <TextField
          label="Actual litres"
          type="number"
          fullWidth
          size="medium"
          value={litres}
          onChange={(e) => setLitres(e.target.value)}
          disabled={disabled || saving}
          inputProps={{ min: 0.01, step: 0.1 }}
        />

        {hasDraft && diff != null && (
          <Typography variant="body2">
            Difference:
            {' '}
            <Chip
              size="small"
              label={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} L`}
              color={varianceTone(planned, parsed)}
            />
          </Typography>
        )}

        {hasDraft && estCost != null && (
          <Typography variant="body2" color="text.secondary">
            Est. cost:
            {' '}
            <strong>{formatK(estCost)}</strong>
            {' '}
            @
            {' '}
            {formatPricePerL(price)}
          </Typography>
        )}

        {localError && <Alert severity="error">{localError}</Alert>}

        <Button
          variant="contained"
          size="medium"
          fullWidth
          onClick={handleDone}
          disabled={disabled || saving}
        >
          {saving ? 'Saving…' : 'Done'}
        </Button>
      </Stack>
    </Box>
  );
};

const OperationRunPage = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const user = useSelector((state) => state.session.user);
  const devicesItems = useSelector((state) => state.devices.items || {});

  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId || !user) return;
    try {
      const details = await fetchOperationSessionDetails(user, sessionId);
      setSession(details);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Failed to load session');
    }
  }, [sessionId, user]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const isClosed = session?.status === 'closed';
  const refuels = session?.refuels || [];

  const pending = useMemo(() => refuels.filter(isPendingRow), [refuels]);
  const completed = useMemo(() => refuels.filter((r) => !isPendingRow(r)), [refuels]);

  const vehicleTotal = refuels.length;
  const completedCount = completed.length;
  const pendingCount = pending.length;

  const plannedTotalL = useMemo(
    () => refuels.reduce((acc, r) => {
      const p = r.plannedFuelLitres != null ? Number(r.plannedFuelLitres) : null;
      if (p != null && Number.isFinite(p) && p > 0) return acc + p;
      const e = r.estimatedFuelLitres != null ? Number(r.estimatedFuelLitres) : 0;
      return acc + (Number.isFinite(e) ? e : 0);
    }, 0),
    [refuels],
  );

  const actualTotalL = Number(session?.totalActualFuel ?? 0);
  const varianceL = actualTotalL - plannedTotalL;

  const submitRefuel = async (update) => {
    await submitSessionRefuelUpdates(user, sessionId, [update]);
    await loadSession();
  };

  const closeSession = async () => {
    setClosing(true);
    setCloseError('');
    try {
      await closeOperationSession(user, sessionId);
      setCloseOpen(false);
      await loadSession();
    } catch (requestError) {
      setCloseError(requestError.message || 'Failed to close session');
    } finally {
      setClosing(false);
    }
  };

  return (
    <>
      <Container maxWidth="sm" disableGutters sx={{ px: { xs: 1.25, sm: 2 }, py: RUNTIME_CONTAINER_PY }}>
        <FleetWorkspaceShell>
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              bgcolor: 'background.default',
              pt: 0.75,
              pb: 0.75,
              mb: 0.75,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Stack spacing={0.4}>
              <Typography variant="subtitle2" fontWeight={800}>
                {session?.name || `Session ${sessionId}`}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip size="small" label={`${completedCount}/${vehicleTotal} done`} />
                <Chip size="small" variant="outlined" label={`Pending ${pendingCount}`} />
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={2}>
                <Typography variant="body2">
                  Dispensed:
                  {' '}
                  <strong>{formatL(session?.totalActualFuel)}</strong>
                </Typography>
                <Typography variant="body2">
                  Cost:
                  {' '}
                  <strong>{formatK(session?.totalActualCost)}</strong>
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button size="small" variant="outlined" onClick={() => navigate('/fleet/operation-sessions')}>
                  Hub
                </Button>
                {!isClosed && (
                  <Button size="small" color="warning" variant="contained" onClick={() => setCloseOpen(true)}>
                    Close session
                  </Button>
                )}
                {isClosed && <Chip label="Closed" color="default" size="small" />}
              </Stack>
            </Stack>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

          {!session && !error && (
            <Typography>Loading…</Typography>
          )}

          {session && (
            <Stack spacing={RUNTIME_STACK_GAP_TIGHT}>
              <Typography variant="subtitle2" fontWeight={800}>Pending refuel</Typography>
              {pending.length === 0 && (
                <Alert severity="success">All vehicles in this session are completed.</Alert>
              )}
              <Stack spacing={RUNTIME_STACK_GAP_TIGHT}>
                {pending.map((refuel) => (
                  <PendingRefuelCard
                    key={refuel.id}
                    refuel={refuel}
                    device={devicesItems[refuel.vehicleId]}
                    disabled={isClosed}
                    onDone={submitRefuel}
                  />
                ))}
              </Stack>

              <Accordion expanded={completedOpen} onChange={() => setCompletedOpen(!completedOpen)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>
                    Completed refuels (
                    {completed.length}
                    )
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={0.75}>
                    {completed.length === 0 && (
                      <Typography variant="body2" color="text.secondary">None yet.</Typography>
                    )}
                    {completed.map((r) => {
                      const dev = devicesItems[r.vehicleId];
                      const pl = r.plannedFuelLitres != null ? Number(r.plannedFuelLitres) : null;
                      const act = Number(r.actualFuelLitres);
                      const varL = pl != null && Number.isFinite(pl) ? act - pl : null;
                      return (
                        <Box
                          key={r.id}
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 1,
                            py: 1,
                            borderBottom: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            ✓
                            {' '}
                            {dev?.name || r.vehicleId}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formatL(r.actualFuelLitres)}
                            {' · '}
                            {formatK(r.actualCost)}
                            {varL != null && Number.isFinite(varL) && (
                              <>
                                {' · '}
                                <Chip
                                  size="small"
                                  label={`${varL >= 0 ? '+' : ''}${varL.toFixed(1)} L`}
                                  color={varianceTone(pl, act)}
                                />
                              </>
                            )}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Stack>
          )}
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
              {formatK(session?.totalActualCost)}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseOpen(false)} disabled={closing}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={closeSession} disabled={closing}>
            {closing ? 'Closing…' : 'Confirm close'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OperationRunPage;
