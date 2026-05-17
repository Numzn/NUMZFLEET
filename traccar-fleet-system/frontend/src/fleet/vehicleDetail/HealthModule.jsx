import { Box } from '@mui/material';
import EngineStatusCard from './EngineStatusCard.jsx';
import { vehicleModuleSx } from './dashboardCardSx.js';

export default function HealthModule({ telemetry }) {
  return (
    <Box id="vehicle-section-health" sx={{ scrollMarginTop: { xs: 72, sm: 96 } }}>
      <Box sx={[vehicleModuleSx, { height: 'auto', bgcolor: 'transparent', border: 'none', boxShadow: 'none', p: 0, backgroundImage: 'none' }]}>
        <EngineStatusCard telemetry={telemetry} />
      </Box>
    </Box>
  );
}
