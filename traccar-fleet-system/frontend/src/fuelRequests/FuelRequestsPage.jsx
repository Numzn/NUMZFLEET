import { Box, Container } from '@mui/material';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import FuelRequestsCard from './components/FuelRequestsCard';
import { RUNTIME_CONTAINER_PY } from '../common/styles/runtimeDensity';

const FuelRequestsPage = () => {
  return (
    <Container maxWidth="xl" sx={{ py: RUNTIME_CONTAINER_PY }}>
      <FleetWorkspaceShell>
        <Box
          sx={{
            px: { xs: 0, sm: 0.5 },
            minHeight: '100%',
            boxSizing: 'border-box',
          }}
        >
          <FuelRequestsCard />
        </Box>
      </FleetWorkspaceShell>
    </Container>
  );
};

export default FuelRequestsPage;
