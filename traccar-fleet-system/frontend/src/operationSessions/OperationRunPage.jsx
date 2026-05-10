import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import AppLayout from '../common/components/AppLayout';
import Breadcrumbs from '../common/components/Breadcrumbs';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import {
  closeOperationSession,
  fetchOperationSessionDetails,
  submitSessionRefuelUpdates,
} from './api/operationSessionsApi';
import RefuelCard from './components/RefuelCard';

const NumberLine = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
    <Typography color="text.secondary">{label}</Typography>
    <Typography>{value}</Typography>
  </Box>
);

const OperationRunPage = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const user = useSelector((state) => state.session.user);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId || !user) return;
    try {
      const details = await fetchOperationSessionDetails(user, sessionId);
      setSession(details);
    } catch (requestError) {
      setError(requestError.message || 'Failed to load session');
    }
  }, [sessionId, user]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const isClosed = session?.status === 'closed';
  const refuels = session?.refuels || [];
  const completed = useMemo(() => refuels.filter((row) => Number(row.actualFuelLitres) > 0).length, [refuels]);

  const submitRefuel = async (update) => {
    await submitSessionRefuelUpdates(user, sessionId, [update]);
    await loadSession();
  };

  const closeSession = async () => {
    setClosing(true);
    setError('');
    try {
      await closeOperationSession(user, sessionId);
      await loadSession();
    } catch (requestError) {
      setError(requestError.message || 'Failed to close session');
    } finally {
      setClosing(false);
    }
  };

  return (
    <AppLayout showSidebar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
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
            <Typography variant="h4">Operation session #{sessionId}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="outlined" onClick={() => navigate('/fleet/operation-sessions')}>
                Hub
              </Button>
              <Button
                variant="outlined"
                color="warning"
                onClick={closeSession}
                disabled={isClosed || closing}
              >
                {closing ? 'Closing...' : isClosed ? 'Closed' : 'Close session'}
              </Button>
            </Stack>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {session && (
            <Stack spacing={1}>
              <Typography variant="h6">Live Summary</Typography>
              <NumberLine label="Vehicles completed" value={`${completed} / ${refuels.length}`} />
              <NumberLine label="Total estimated fuel" value={`${session.totalEstimatedFuel || 0} L`} />
              <NumberLine label="Total actual fuel" value={`${session.totalActualFuel || 0} L`} />
              <NumberLine label="Total estimated cost" value={`ZMW ${session.totalEstimatedCost || 0}`} />
              <NumberLine label="Total actual cost" value={`ZMW ${session.totalActualCost || 0}`} />
              <NumberLine label="Validation" value={`normal ${session.statusCounts?.normal ?? 0} · warning ${session.statusCounts?.warning ?? 0} · flagged ${session.statusCounts?.flagged ?? 0} · incomplete ${session.statusCounts?.incomplete ?? 0}`} />
            </Stack>
          )}

          <Stack spacing={1.5}>
            {refuels.map((refuel) => (
              <RefuelCard
                key={refuel.id}
                refuel={refuel}
                onSubmit={submitRefuel}
                disabled={isClosed}
              />
            ))}
            {!refuels.length && (
              <Alert severity="info">No prepared refuels in this session yet.</Alert>
            )}
          </Stack>
        </Stack>
        </FleetWorkspaceShell>
      </Container>
    </AppLayout>
  );
};

export default OperationRunPage;
