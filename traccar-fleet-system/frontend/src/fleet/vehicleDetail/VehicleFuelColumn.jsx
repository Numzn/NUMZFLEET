import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import useVehicleFuelRequests from './hooks/useVehicleFuelRequests.js';
import useTodayOperationRefuel from './hooks/useTodayOperationRefuel.js';
import { formatLitres } from '../../operationSessions/utils/formatters.js';

export default function VehicleFuelColumn({ deviceId }) {
  const navigate = useNavigate();
  const { pendingCount } = useVehicleFuelRequests(deviceId);
  const {
    operation: todayOp,
    refuel: todayRefuel,
    hasTodayPlan,
    isComplete: todayComplete,
    canRefuel,
    loading: todayLoading,
  } = useTodayOperationRefuel(deviceId);

  return (
    <Box sx={vehicleWorkspaceCardSx}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Today&apos;s Operations
      </Typography>

      <Box sx={{ mb: 2 }}>
        {todayLoading && (
          <Typography variant="body2" color="text.secondary">Loading…</Typography>
        )}
        {!todayLoading && !todayOp && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              No Fueling Day planned for today.
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              size="small"
              onClick={() => navigate('/fleet/operation-sessions/prepare')}
              sx={{ textTransform: 'none' }}
            >
              Plan today&apos;s fuel
            </Button>
          </>
        )}
        {!todayLoading && todayOp && !hasTodayPlan && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Not included in today&apos;s plan.
            </Typography>
            <Button
              variant="text"
              fullWidth
              size="small"
              onClick={() => navigate('/fleet/operation-sessions/prepare')}
              sx={{ textTransform: 'none' }}
            >
              View Plan →
            </Button>
          </>
        )}
        {!todayLoading && todayOp && hasTodayPlan && (
          <>
            <Typography variant="body2" fontWeight={600}>
              {todayComplete ? 'Refueled today' : 'Planned for today'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Planned:
              {' '}
              {todayRefuel?.plannedFuelLitres != null
                ? formatLitres(todayRefuel.plannedFuelLitres)
                : formatLitres(todayRefuel?.estimatedFuelLitres)}
              {todayComplete && todayRefuel?.actualFuelLitres != null && (
                <>
                  {' · Actual: '}
                  {formatLitres(todayRefuel.actualFuelLitres)}
                </>
              )}
            </Typography>
            {canRefuel && todayOp?.id && (
              <Button
                variant="contained"
                fullWidth
                size="small"
                sx={{ mt: 1, textTransform: 'none' }}
                onClick={() => navigate(`/fleet/operation-sessions/fuel/${todayOp.id}`)}
              >
                Record refuel →
              </Button>
            )}
            {!canRefuel && !todayComplete && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Awaiting manager approval before fueling.
              </Typography>
            )}
          </>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pt: 2, borderTop: '1px solid var(--surface-border)' }}>
        <Typography variant="body2" color="text.secondary">
          {pendingCount} {pendingCount === 1 ? 'request' : 'requests'} awaiting approval
        </Typography>
        <Button
          variant={pendingCount > 0 ? 'contained' : 'outlined'}
          size="small"
          disabled={pendingCount === 0}
          onClick={() => navigate('/fuel-requests')}
          sx={{ textTransform: 'none', flexShrink: 0 }}
        >
          Review requests →
        </Button>
      </Box>
    </Box>
  );
}
