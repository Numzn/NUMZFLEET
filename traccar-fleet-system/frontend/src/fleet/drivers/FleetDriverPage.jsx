import DriverPage from '../../settings/DriverPage.jsx';
import { Container } from '@mui/material';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';

export default function FleetDriverPage() {
  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <FleetWorkspaceShell>
        <DriverPage />
      </FleetWorkspaceShell>
    </Container>
  );
}
