import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
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
import { fetchVehicles, fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
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

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [expandedRefuelId, setExpandedRefuelId] = useState(null);
  const [fleetVehicles, setFleetVehicles] = useState([]);

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

  useEffect(() => {
    if (!user) return;
    fetchVehicles(user).then(
      (data) => setFleetVehicles(Array.isArray(data) ? data : []),
      () => setFleetVehicles([]),
    );
  }, [user]);

  const capacityByDeviceId = useMemo(() => {
    const map = {};
    for (const v of fleetVehicles) {
      const deviceId = v.assignment?.deviceId;
      if (deviceId != null) {
        map[Number(deviceId)] = {
          capacityL: v.vehicleSpec?.tankCapacity ?? null,
          capacitySource: v.vehicleSpec?.tankCapacitySource ?? 'default',
        };
      }
    }
    return map;
  }, [fleetVehicles]);

  const effectiveStatus = session?.effectiveStatus || session?.status;
  const isReadOnly = session?.isWritable === false || String(effectiveStatus).toLowerCase() === 'locked';
  const canRecord = session?.canRecordFuel && !isReadOnly;
  const refuels = session?.refuels || [];

  const active = useMemo(
    () => refuels.filter((r) => !isRefuelComplete(r) && !isRefuelSkipped(r)),
    [refuels],
  );
  // At-pump vehicles surface first, then the rest of the waiting queue.
  const queue = useMemo(
    () => [...active].sort((a, b) => (b.arrivedAt != null) - (a.arrivedAt != null)),
    [active],
  );
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
    setExpandedRefuelId(null);
    await loadSession();
  };

  const submitArrived = async (refuelId) => {
    await markRefuelArrived(user, sessionId, { refuelId });
    await loadSession();
  };

  const submitSkip = async (refuelId, reason) => {
    await skipOperationVehicle(user, sessionId, { refuelId, reason });
    setExpandedRefuelId(null);
    await loadSession();
  };

  return (
    <>
      <OperationRunHeader session={session} buckets={buckets} />

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

          {queue.length > 0 && (
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Vehicles
                {' '}
                (
                {queue.length}
                )
              </Typography>
              <Stack spacing={0}>
                {queue.map((refuel) => {
                  const capacity = capacityByDeviceId[refuel.vehicleId] || {};
                  return (
                    <PendingRefuelCard
                      key={refuel.id}
                      refuel={refuel}
                      capacityL={capacity.capacityL}
                      capacitySource={capacity.capacitySource}
                      disabled={!canRecord}
                      sessionInProgress={canRecord}
                      previousMileage={previousMileageByVehicle[refuel.vehicleId]}
                      expanded={expandedRefuelId === refuel.id}
                      onToggleExpand={(id) => setExpandedRefuelId((prev) => (prev === id ? null : id))}
                      onDone={submitRefuel}
                      onArrived={submitArrived}
                      onSkip={canRecord ? submitSkip : undefined}
                    />
                  );
                })}
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
