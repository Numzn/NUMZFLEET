import { Container, Stack, Typography } from '@mui/material';
import FleetWorkspaceShell from '../common/components/FleetWorkspaceShell';
import { RUNTIME_CONTAINER_PY, RUNTIME_STACK_GAP } from '../common/styles/runtimeDensity';
import OperationReportsSection from '../operationSessions/components/OperationReportsSection.jsx';
import ReportsMenu from './components/ReportsMenu';

const FuelOperationsReportPage = () => (
  <Container maxWidth="md" disableGutters sx={{ py: RUNTIME_CONTAINER_PY }}>
    <FleetWorkspaceShell>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <ReportsMenu />
        <Stack spacing={RUNTIME_STACK_GAP} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={800}>Fuel reports</Typography>
          <Typography variant="body2" color="text.secondary">
            Fleet-wide forecast accuracy, budget performance, and daily KPIs.
          </Typography>
          <OperationReportsSection />
        </Stack>
      </Stack>
    </FleetWorkspaceShell>
  </Container>
);

export default FuelOperationsReportPage;
