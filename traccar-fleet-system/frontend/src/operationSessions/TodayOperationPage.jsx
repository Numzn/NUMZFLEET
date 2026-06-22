import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  List,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import { useManager } from '../common/util/permissions';
import useTodayOperation from './hooks/useTodayOperation.js';
import OperationVehicleRow from './components/OperationVehicleRow.jsx';
import DailyOperationAccordion from './components/DailyOperationAccordion.jsx';
import OperationDaySummary from './components/OperationDaySummary.jsx';
import { deriveVehicleWorkflowState, isRefuelException } from './utils/operationDayUtils.js';
import { fuelApiErrorMessage } from '../fleet/vehiclesApi.js';

const TodayOperationPage = () => {
  const navigate = useNavigate();
  const isManager = useManager();
  const {
    todayOperation, todayOperations, todayDetails, loading, error, reload,
  } = useTodayOperation();

  const showManagerList = isManager && (todayOperations?.length || 0) > 1;

  const status = String(
    todayDetails?.effectiveStatus || todayOperation?.effectiveStatus || todayOperation?.status || '',
  ).toLowerCase();

  const canEditForecast = todayDetails?.canEditForecast ?? todayOperation?.canEditForecast;
  const canRecordFuel = todayDetails?.canRecordFuel ?? todayOperation?.canRecordFuel;
  const isLocked = status === 'locked';
  const hasOperation = Boolean(todayOperation?.id);

  const primaryCta = useMemo(() => {
    if (!hasOperation) {
      return { label: 'Prepare Fueling Day', path: '/fleet/operation-sessions/prepare' };
    }
    if (status === 'draft' || canEditForecast) {
      return { label: 'Continue preparing', path: '/fleet/operation-sessions/prepare' };
    }
    if (canRecordFuel || status === 'approved') {
      return {
        label: 'Continue Fueling',
        path: `/fleet/operation-sessions/fuel/${todayOperation.id}`,
      };
    }
    if (isLocked) {
      return { label: 'View history', path: '/fleet/operation-sessions/history' };
    }
    return null;
  }, [canEditForecast, canRecordFuel, hasOperation, isLocked, status, todayOperation?.id]);

  const statusMessage = useMemo(() => {
    if (!hasOperation) {
      return 'Select vehicles and planned litres, then start the day.';
    }
    if (status === 'draft') {
      return 'Finish preparing and start the Fueling Day before recording refuels.';
    }
    if (status === 'approved' && canRecordFuel) {
      return 'Record fuel as each vehicle is serviced at the pump.';
    }
    if (isLocked) {
      return 'Today\'s Fueling Day is closed.';
    }
    return 'Waiting for the Fueling Day to start.';
  }, [canRecordFuel, hasOperation, isLocked, status]);

  const attentionVehicles = useMemo(() => {
    const refuels = todayDetails?.refuels || [];
    return refuels.filter((refuel) => {
      const state = deriveVehicleWorkflowState(refuel);
      if (state === 'fueled' || state === 'skipped') return false;
      return state === 'planned' || state === 'arrived' || isRefuelException(refuel);
    });
  }, [todayDetails]);

  const hasPlannedVehicles = (todayDetails?.refuels?.length || 0) > 0;

  return (
    <Stack spacing={RUNTIME_STACK_GAP}>
      {error && (
        <Alert severity="error">{fuelApiErrorMessage(error, 'Failed to load today\'s operation')}</Alert>
      )}

      {loading && (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && showManagerList && (
        <>
          <Alert severity="info">
            {todayOperations.length}
            {' '}
            fuel operations across the fleet today. Approve, record, or unlock each below.
          </Alert>
          <Stack spacing={1}>
            {todayOperations.map((op) => (
              <DailyOperationAccordion
                key={op.id}
                calendarDate={String(op.calendarDate || '').slice(0, 10)}
                operation={op}
                isToday
              />
            ))}
          </Stack>
        </>
      )}

      {!loading && !showManagerList && (
        <>
          {hasOperation && todayDetails ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                <OperationDaySummary
                  operation={todayOperation}
                  details={todayDetails}
                  variant="full"
                />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                    pt: 0.5,
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 200 }}>
                    {statusMessage}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => reload()} disabled={loading}>
                      Refresh
                    </Button>
                    {primaryCta && (
                      <Button
                        variant="contained"
                        onClick={() => navigate(primaryCta.path)}
                        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                      >
                        {primaryCta.label}
                      </Button>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                spacing={2}
              >
                <Typography variant="body2" color="text.secondary">
                  {statusMessage}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button size="small" variant="outlined" onClick={() => reload()} disabled={loading}>
                    Refresh
                  </Button>
                  {primaryCta && (
                    <Button
                      variant="contained"
                      onClick={() => navigate(primaryCta.path)}
                      sx={{ textTransform: 'none' }}
                    >
                      {primaryCta.label}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          )}

          {hasOperation && hasPlannedVehicles && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Vehicles requiring attention
              </Typography>
              {attentionVehicles.length === 0 ? (
                <Alert severity="success">
                  Every planned vehicle has been fueled or skipped.
                </Alert>
              ) : (
                <Paper variant="outlined">
                  <List disablePadding>
                    {attentionVehicles.map((refuel) => (
                      <OperationVehicleRow key={refuel.id} refuel={refuel} linkTarget="fuel" />
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
          )}
        </>
      )}
    </Stack>
  );
};

export default TodayOperationPage;
