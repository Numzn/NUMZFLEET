import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AppLayout from '../common/components/AppLayout';
import Breadcrumbs from '../common/components/Breadcrumbs';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import { fetchOperationSessionDetails, fetchOperationSessions } from './api/operationSessionsApi';

const formatDateLabel = (iso) => new Date(iso).toLocaleDateString(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** Names auto-filled by hub/plan flows — prefer live device names from refuels for history rows. */
function isPlaceholderSessionName(name) {
  if (name == null || typeof name !== 'string') return true;
  const t = name.trim();
  if (!t) return true;
  return /^Quick operation /i.test(t) || /^Fuel Session /i.test(t);
}

/**
 * One row = one operation session (typically one vehicle that day). Uses Traccar device names when available.
 */
function getHistorySessionTitle(session, detail, devicesItems) {
  const refuels = detail?.refuels || [];
  const ids = [
    ...new Set(
      refuels
        .map((r) => Number(r.vehicleId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];

  if (ids.length === 1) {
    const dev = devicesItems[ids[0]];
    return dev?.name?.trim() || `Vehicle ${ids[0]}`;
  }

  if (ids.length > 1) {
    const labels = ids.map((id) => {
      const dev = devicesItems[id];
      return dev?.name?.trim() || `#${id}`;
    });
    if (labels.length <= 2) {
      return labels.join(' · ');
    }
    return `${labels.slice(0, 2).join(' · ')} +${labels.length - 2} more`;
  }

  if (!isPlaceholderSessionName(session?.name)) {
    return session.name.trim();
  }

  if (detail == null) {
    return 'Loading…';
  }

  return 'No vehicle on record';
}

const HistoryPage = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.session.user);
  const devicesItems = useSelector((state) => state.devices.items || {});
  const [sessions, setSessions] = useState([]);
  const [details, setDetails] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setError('');
      try {
        const list = await fetchOperationSessions(user);
        setSessions(Array.isArray(list) ? list : []);
        const entries = await Promise.all((list || []).map(async (session) => {
          const detail = await fetchOperationSessionDetails(user, session.id);
          return [session.id, detail];
        }));
        setDetails(Object.fromEntries(entries));
      } catch (requestError) {
        setError(requestError.message || 'Failed to load operation history');
      }
    };
    load();
  }, [user]);

  const grouped = useMemo(() => {
    const map = {};
    sessions.forEach((session) => {
      const key = formatDateLabel(session.sessionDate || session.createdAt || new Date().toISOString());
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(session);
    });
    return map;
  }, [sessions]);

  return (
    <AppLayout showSidebar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Breadcrumbs />
        <FleetWorkspaceShell>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h4">Operation history</Typography>
            <Button variant="outlined" size="small" onClick={() => navigate('/fleet/operation-sessions')}>
              Operations hub
            </Button>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}

          {Object.entries(grouped).map(([dateLabel, dateSessions]) => (
            <Accordion key={dateLabel} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 2, alignItems: 'flex-start', gap: 2 }}>
                  <Box>
                    <Typography component="span" sx={{ display: 'block' }}>{dateLabel}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {dateSessions.length} session{dateSessions.length === 1 ? '' : 's'} · fleet day
                    </Typography>
                  </Box>
                  <Typography color="text.secondary" sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {`ZMW ${dateSessions.reduce((sum, s) => sum + Number(s.totalActualCost || 0), 0).toFixed(2)} / `}
                    {`${dateSessions.reduce((sum, s) => sum + Number(s.totalEstimatedCost || 0), 0).toFixed(2)} | `}
                    {`${dateSessions.reduce((sum, s) => sum + Number(s.totalVarianceCost || 0), 0).toFixed(2)}`}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  {dateSessions.map((session) => {
                    const detail = details[session.id];
                    const counts = detail?.statusCounts || { normal: 0, warning: 0, flagged: 0 };
                    const titleLine = getHistorySessionTitle(session, detail, devicesItems);
                    return (
                      <Box
                        key={session.id}
                        sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}
                        title={`Session #${session.id} · vehicles: ${detail?.vehicleCount || 0} · normal: ${counts.normal} · warning: ${counts.warning} · flagged: ${counts.flagged}`}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ pr: 1 }}>
                            {titleLine}
                          </Typography>
                          <Chip size="small" label={session.status} color={session.status === 'closed' ? 'default' : 'success'} />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {`Actual: ZMW ${session.totalActualCost || 0} | Estimated: ZMW ${session.totalEstimatedCost || 0} | Variance: ZMW ${session.totalVarianceCost || 0}`}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}

          {!sessions.length && <Alert severity="info">No operation sessions available yet.</Alert>}
        </Stack>
        </FleetWorkspaceShell>
      </Container>
    </AppLayout>
  );
};

export default HistoryPage;
