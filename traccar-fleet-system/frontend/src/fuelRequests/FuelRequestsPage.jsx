import { Box } from '@mui/material';
import AppLayout from '../common/components/AppLayout';
import FuelRequestsCard from './components/FuelRequestsCard';

const FuelRequestsPage = () => {
  return (
    <AppLayout showSidebar={true}>
      <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3.5, lg: 4 }, py: { xs: 1.5, sm: 2.5, md: 3 }, minHeight: '100%', boxSizing: 'border-box' }}>
        <FuelRequestsCard />
      </Box>
    </AppLayout>
  );
};

export default FuelRequestsPage;
