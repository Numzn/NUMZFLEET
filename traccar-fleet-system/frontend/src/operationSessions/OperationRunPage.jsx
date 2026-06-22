import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import {
  fetchOperationSessionDetails,
  recordOperationRefuel,
  markRefuelArrived,
  skipOperationVehicle,
} from './api/operationSessionsApi';
import { isRefuelComplete, isRefuelSkipped, summarizeRefuelBuckets } from './utils/operationDayUtils.js';
import PendingRefuelCard from './components/PendingRefuelCard.jsx';
import CompletedRefuelCard from './components/CompletedRefuelCard.jsx';
import OperationVehicleRow from './components/OperationVehicleRow.jsx';
import OperationRunHeader from './components/OperationRunHeader.jsx';

const OperationRunPage = () => {
  const { sessionId } = useParams();
  const user = useSelector((state) => state.session.user);
  const devicesItems = useSelector((state) => state.devices.items || {});

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);
  const [skippedOpen, setSkippedOpen] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const details = await fetchOperationSessionDetails(user, sessionId);
      setSession(details);
      setError('');
    } catch (requestError) {
      setError(fuelApiErrorMessage(requestError, 'Failed to load session'));
    } finally {
      setLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const effectiveStatus = session?.effectiveStatus || session?.status;
  const isReadOnly = session?.isWritable === false || String(effectiveStatus).toLowerCase() === 'locked';
  const canRecord = session?.canRecordFuel && !isReadOnly;
  const refuels = session?.refuels || [];

  const active = useMemo(
    () => refuels.filter((r) => !isRefuelComplete(r) && !isRefuelSkipped(r)),
    [refuels],
  );
  const waiting = useMemo(() => active.filter((r) => r.arrivedAt == null), [active]);
  const atPump = useMemo(() => active.filter((r) => r.arrivedAt != null), [active]);
  const completed = useMemo(() => refuels.filter(isRefuelComplete), [refuels]);
  const skipped = useMemo(() => refuels.filter(isRefuelSkipped), [refuels]);
  const buckets = useMemo(() => summarizeRefuelBuckets(refuels), [refuels]);

  const lockBanner = useMemo(() => {
    if (!session?.locksAt) return null;
    const locksAt = new Date(session.locksAt);
    if (Number.isNaN(locksAt.getTime())) return null;
    const ms = locksAt.getTime() - Date.now();
    if (isReadOnly) {
      return 'This Fueling Day is closed. Refuel lines are read-only.';
    }
    if (ms > 0 && ms <= 30 * 60 * 1000) {
      return `Today's Fueling Day locks at ${locksAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    }
    return null;
  }, [session?.locksAt, isReadOnly]);

  const previousMileageByVehicle = useMemo(() => {
    const map = {};
    for (const r of completed) {
      if (r.currentMileage != null) map[r.vehicleId] = Number(r.currentMileage);
    }
    return map;
  }, [completed]);

  const submitRefuel = async (payload) => {
    await recordOperationRefuel(user, sessionId, payload);
    await loadSession();
  };

  const submitArrived = async (refuelId) => {
    await markRefuelArrived(user, sessionId, { refuelId });
    await loadSession();
  };

  const submitSkip = async (refuelId, reason) => {
    await skipOperationVehicle(user, sessionId, { refuelId, reason });
    await loadSession();
  };

  return (
    <>
      <OperationRunHeader
        session={session}
        sessionId={sessionId}
        buckets={buckets}
      />

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {lockBanner && (
        <Alert severity={isReadOnly ? 'info' : 'warning'} sx={{ mb: 1 }}>
          {lockBanner}
        </Alert>
      )}

      {!canRecord && !isReadOnly && session?.status === 'draft' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Start the Fueling Day from Prepare before recording refuels.
        </Alert>
      )}

      {loading && (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && session && (
        <Stack spacing={1.5}>
          {active.length === 0 && (
            <Alert severity="success">Every planned vehicle has been fueled or skipped.</Alert>
          )}

          {atPump.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                At pump
                <Typography component="span" variant="body2" color="text.secondary" fontWeight={400} sx={{ ml: 1 }}>
                  ({atPump.length})
                </Typography>
              </Typography>
              <Stack spacing={1.25}>
                {atPump.map((refuel) => (
                  <PendingRefuelCard
                    key={refuel.id}
                    refuel={refuel}
                    device={devicesItems[refuel.vehicleId]}
                    disabled={!canRecord}
                    previousMileage={previousMileageByVehicle[refuel.vehicleId]}
                    onDone={submitRefuel}
                    onArrived={submitArrived}
                    onSkip={canRecord ? submitSkip : undefined}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {waiting.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Waiting
                <Typography component="span" variant="body2" color="text.secondary" fontWeight={400} sx={{ ml: 1 }}>
                  ({waiting.length})
                </Typography>
              </Typography>
              <Stack spacing={1.25}>
                {waiting.map((refuel) => (
                  <PendingRefuelCard
                    key={refuel.id}
                    refuel={refuel}
                    device={devicesItems[refuel.vehicleId]}
                    disabled={!canRecord}
                    previousMileage={previousMileageByVehicle[refuel.vehicleId]}
                    onDone={submitRefuel}
                    onArrived={submitArrived}
                    onSkip={canRecord ? submitSkip : undefined}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Accordion expanded={completedOpen} onChange={() => setCompletedOpen(!completedOpen)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>
                Completed (
                {completed.length}
                )
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={0.75}>
                {completed.length === 0 && (
                  <Typography variant="body2" color="text.secondary">None yet.</Typography>
                )}
                {completed.map((r) => (
                  <CompletedRefuelCard key={r.id} refuel={r} />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {skipped.length > 0 && (
            <Accordion expanded={skippedOpen} onChange={() => setSkippedOpen(!skippedOpen)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>
                  Skipped (
                  {skipped.length}
                  )
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                {skipped.map((r) => (
                  <OperationVehicleRow key={r.id} refuel={r} linkTarget="fuel" />
                ))}
              </AccordionDetails>
            </Accordion>
          )}
        </Stack>
      )}
    </>
  );
};

export default OperationRunPage;
