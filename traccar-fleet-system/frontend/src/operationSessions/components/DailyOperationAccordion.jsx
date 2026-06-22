import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { fuelApiErrorMessage } from '../../fleet/vehiclesApi.js';
import { useManager } from '../../common/util/permissions';
import { fetchOperationSessionDetails } from '../api/operationSessionsApi.js';
import { operationSessionsActions } from '../store/operationSessions.js';
import OperationDaySummary from './OperationDaySummary.jsx';
import OperationVehicleRow from './OperationVehicleRow.jsx';
import CorrectionDialog from './CorrectionDialog.jsx';
import UnlockDialog from './UnlockDialog.jsx';

export default function DailyOperationAccordion({
  calendarDate,
  operation,
  defaultExpanded = false,
  isToday = false,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isManager = useManager();
  const user = useSelector((state) => state.session.user);
  const cachedDetails = useSelector((state) => state.operationSessions?.details?.[operation?.id]);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [details, setDetails] = useState(cachedDetails || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [correctionRefuel, setCorrectionRefuel] = useState(null);
  const [unlockOpen, setUnlockOpen] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!user || !operation?.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchOperationSessionDetails(user, operation.id);
      setDetails(data);
      dispatch(operationSessionsActions.upsertDetails({ sessionId: operation.id, data }));
    } catch (err) {
      setError(fuelApiErrorMessage(err, 'Failed to load operation details'));
    } finally {
      setLoading(false);
    }
  }, [dispatch, operation?.id, user]);

  useEffect(() => {
    if (expanded && !details && !loading) {
      loadDetails();
    }
  }, [expanded, details, loadDetails, loading]);

  const effectiveStatus = details?.effectiveStatus || operation?.effectiveStatus || operation?.status;
  const isLocked = String(effectiveStatus).toLowerCase() === 'locked';
  const canForecast = details?.canEditForecast ?? operation?.canEditForecast;
  const canRun = details?.canRecordFuel ?? operation?.canRecordFuel;

  return (
    <>
      <Accordion
        expanded={expanded}
        onChange={(_, v) => setExpanded(v)}
        variant="outlined"
        disableGutters
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
            <Typography fontWeight={700}>
              {calendarDate}
              {isToday && (
                <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 1 }}>
                  Today
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {String(effectiveStatus || '').toUpperCase()}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            {error && <Alert severity="error">{error}</Alert>}
            {loading && !details && (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {details && (
              <>
                <OperationDaySummary operation={operation} details={details} variant="full" />
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {canForecast && (
                    <Button size="small" variant="outlined" onClick={() => navigate('/fleet/operation-sessions/prepare')}>
                      Prepare
                    </Button>
                  )}
                  {(canRun) && operation?.id && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => navigate(`/fleet/operation-sessions/fuel/${operation.id}`)}
                    >
                      Fuel vehicles
                    </Button>
                  )}
                  {isLocked && isManager && operation?.id && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() => setUnlockOpen(true)}
                    >
                      Unlock
                    </Button>
                  )}
                </Stack>
                <Typography variant="subtitle2" fontWeight={700}>Vehicles</Typography>
                <List disablePadding>
                  {(details.refuels || []).map((refuel) => (
                    <OperationVehicleRow
                      key={refuel.id}
                      refuel={refuel}
                      onReportCorrection={isLocked ? setCorrectionRefuel : null}
                    />
                  ))}
                  {(details.refuels || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary">No vehicles planned.</Typography>
                  )}
                </List>
              </>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {correctionRefuel && (
        <CorrectionDialog
          open={Boolean(correctionRefuel)}
          operationId={operation.id}
          refuel={correctionRefuel}
          onClose={() => setCorrectionRefuel(null)}
          onSubmitted={() => {
            setCorrectionRefuel(null);
            loadDetails();
          }}
        />
      )}

      {unlockOpen && operation?.id && (
        <UnlockDialog
          open={unlockOpen}
          operationId={operation.id}
          onClose={() => setUnlockOpen(false)}
          onUnlocked={() => {
            setUnlockOpen(false);
            loadDetails();
          }}
        />
      )}
    </>
  );
}
