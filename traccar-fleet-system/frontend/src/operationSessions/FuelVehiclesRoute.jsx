import { Navigate, useParams } from 'react-router-dom';
import { Alert, Box, CircularProgress } from '@mui/material';
import { fuelApiErrorMessage } from '../fleet/vehiclesApi.js';
import useTodayOperation from './hooks/useTodayOperation.js';

/**
 * Index for the "Fuel vehicles" tab. Resolves today's Fueling Day and forwards
 * to its run view; shows guidance when nothing has been prepared yet.
 */
export default function FuelVehiclesRoute() {
  const { todayOperation, loading, error } = useTodayOperation();

  if (loading) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{fuelApiErrorMessage(error, 'Failed to load Fueling Day')}</Alert>;
  }

  if (todayOperation?.id) {
    return <Navigate to={`/fleet/operation-sessions/fuel/${todayOperation.id}`} replace />;
  }

  return <Alert severity="info">No Fueling Day yet. Prepare one to start fueling vehicles.</Alert>;
}

/** Legacy redirect: /fleet/operation-sessions/run/:sessionId -> /fuel/:sessionId */
export function RunRedirect() {
  const { sessionId } = useParams();
  return <Navigate to={`/fleet/operation-sessions/fuel/${sessionId}`} replace />;
}
