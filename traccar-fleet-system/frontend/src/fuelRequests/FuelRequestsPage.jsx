import { Box } from '@mui/material';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import FuelRequestsCard from './components/FuelRequestsCard';
import { RUNTIME_CONTAINER_PY } from '../common/styles/runtimeDensity';

const FuelRequestsPage = () => {
  return (
    <Box sx={{ width: '100%', py: RUNTIME_CONTAINER_PY }}>
      <FleetWorkspaceShell>
        <Box
          sx={{
            minHeight: '100%',
            boxSizing: 'border-box',
          }}
        >
          <FuelRequestsCard />
        </Box>
      </FleetWorkspaceShell>
    </Box>
  );
};

export default FuelRequestsPage;
