import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import { useManager } from '../common/util/permissions';
import { fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import useTodayOperation from './hooks/useTodayOperation.js';
import { closeOperationSession } from './api/operationSessionsApi.js';
import { summarizeRefuelBuckets } from './utils/operationDayUtils.js';
import OperationDaySummary from './components/OperationDaySummary.jsx';

export default function ReviewClosePage() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.session.user);
  const isManager = useManager();
  const {
    todayOperation, todayDetails, loading, error, reload,
  } = useTodayOperation();

  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');

  const sessionId = todayOperation?.id;
  const status = String(
    todayDetails?.effectiveStatus || todayOperation?.effectiveStatus || todayOperation?.status || '',
  ).toLowerCase();
  const isLocked = status === 'locked';
  const buckets = summarizeRefuelBuckets(todayDetails?.refuels || []);
  const canClose = isManager && status === 'approved';

  const invoiceSummary = todayDetails?.invoiceSummary;
  const invoiceCount = invoiceSummary?.count || 0;
  const warnings = [];
  if (buckets.missing > 0) {
    warnings.push(`${buckets.missing} vehicle${buckets.missing === 1 ? '' : 's'} not yet fueled`);
  }
  if (buckets.skipped > 0) {
    warnings.push(`${buckets.skipped} vehicle${buckets.skipped === 1 ? '' : 's'} skipped`);
  }
  if (invoiceCount === 0) {
    warnings.push('No Smart Invoices attached');
  } else if (invoiceSummary?.status === 'variance') {
    warnings.push('Invoice litres do not match dispensed total');
  }

  const handleClose = async () => {
    setClosing(true);
    setCloseError('');
    try {
      await closeOperationSession(user, sessionId);
      await reload();
      navigate('/fleet/operation-sessions/history');
    } catch (e) {
      setCloseError(fuelApiErrorMessage(e, 'Failed to close Fueling Day'));
    } finally {
      setClosing(false);
    }
  };

  if (loading && !todayDetails) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{fuelApiErrorMessage(error, 'Failed to load Fueling Day')}</Alert>;
  }

  if (!sessionId) {
    return <Alert severity="info">No Fueling Day yet. Prepare one before reviewing.</Alert>;
  }

  return (
    <Stack spacing={RUNTIME_STACK_GAP}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" fontWeight={800}>Fueling Day summary</Typography>
          <OperationDaySummary
            operation={todayOperation}
            details={todayDetails}
            variant="full"
            phase="closeout"
          />
          <Typography variant="body2" color="text.secondary">
            {invoiceCount === 0
              ? 'No Smart Invoices attached.'
              : `${invoiceCount} Smart Invoice${invoiceCount === 1 ? '' : 's'} attached.`}
          </Typography>
          {warnings.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
                Warnings
              </Typography>
              <Stack spacing={0.5}>
                {warnings.map((warning) => (
                  <Typography key={warning} variant="body2" color="warning.main">
                    {warning}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Paper>

      {isLocked ? (
        <Alert severity="info">This Fueling Day is closed. Refuel lines and invoices are read-only.</Alert>
      ) : (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2" fontWeight={700}>Close Fueling Day</Typography>
            <Typography variant="body2" color="text.secondary">
              Closing locks today&apos;s refuels and invoices. The day also locks automatically at the end of the day.
            </Typography>
            {closeError && <Alert severity="error">{closeError}</Alert>}
            {!isManager && (
              <Alert severity="info">Only managers can close a Fueling Day.</Alert>
            )}
            <Box>
              <Button
                variant="contained"
                color="warning"
                onClick={handleClose}
                disabled={!canClose || closing}
              >
                {closing ? 'Closing…' : 'Close Fueling Day'}
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
