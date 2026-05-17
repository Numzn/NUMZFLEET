import { Box, Grid, Typography } from '@mui/material';
import FuelCard from './FuelCard';
import ErbInsightCard from './ErbInsightCard';
import { vehicleModuleSx } from './dashboardCardSx.js';

export default function FuelModule({ fuel, erb, vehicleSpec }) {
  return (
    <Box sx={[vehicleModuleSx, { height: 'auto', bgcolor: 'transparent', border: 'none', boxShadow: 'none', p: 0, backgroundImage: 'none' }]}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
        Fuel
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FuelCard fuel={fuel} />
        </Grid>
        <Grid item xs={12} md={6}>
          <ErbInsightCard erb={erb} vehicleSpec={vehicleSpec} />
        </Grid>
      </Grid>
    </Box>
  );
}
