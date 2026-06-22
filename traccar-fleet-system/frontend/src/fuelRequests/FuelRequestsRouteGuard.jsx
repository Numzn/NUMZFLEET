import { Alert, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useFeatures from '../common/util/useFeatures';
import FuelRequestsPage from './FuelRequestsPage';

/**
 * Renders the legacy driver fuel requests page, or a friendly notice when an
 * administrator has disabled the feature in Server settings.
 */
export default function FuelRequestsRouteGuard() {
  const { enableFuelRequests } = useFeatures();
  const navigate = useNavigate();

  if (enableFuelRequests) {
    return <FuelRequestsPage />;
  }

  return (
    <Box sx={{ p: 3, maxWidth: 560, mx: 'auto' }}>
      <Alert
        severity="info"
        action={(
          <Button color="inherit" size="small" onClick={() => navigate('/fleet/operation-sessions')}>
            Daily operations
          </Button>
        )}
      >
        Driver fuel requests have been disabled by an administrator. Use Daily fuel operations instead.
      </Alert>
    </Box>
  );
}
