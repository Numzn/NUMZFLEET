import { Box, Button, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { vehicleModuleSx } from './dashboardCardSx.js';

const formatErbTime = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function ErbInsightCard({ erb, vehicleSpec }) {
  return (
    <Box sx={vehicleModuleSx}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Fuel price (ERB)
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Energy Regulation Board snapshot ({vehicleSpec?.fuelType || erb.fuelKey})
      </Typography>
      {erb.pricePerL != null ? (
        <Typography variant="h5" fontWeight={700} sx={{ my: 1 }}>
          ZMW {erb.pricePerL.toFixed(2)} /L
        </Typography>
      ) : (
        <Typography variant="body2" color="warning.main" sx={{ my: 1 }}>
          {erb.error || 'Price unavailable'}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" display="block">
        {formatErbTime(erb.timestamp) || '—'}
      </Typography>
      <Button
        size="small"
        endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
        href="https://www.erb.org.zm/"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ mt: 1, textTransform: 'none' }}
      >
        View ERB report
      </Button>
    </Box>
  );
}
