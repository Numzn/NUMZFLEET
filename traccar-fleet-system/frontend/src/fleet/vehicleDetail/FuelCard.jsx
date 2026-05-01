import { Box, Typography, LinearProgress } from '@mui/material';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

import { vehicleDashboardCardSx } from './dashboardCardSx.js';

export default function FuelCard({ fuel }) {
  const pct = fuel.levelPct != null ? Math.max(0, Math.min(100, fuel.levelPct)) : null;

  return (
    <Box sx={vehicleDashboardCardSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LocalGasStationIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>
          Fuel
        </Typography>
      </Box>
      {pct != null ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 1 }}>
            <Typography variant="h4" fontWeight={700}>
              {Math.round(pct)}%
            </Typography>
            {fuel.litresLeft != null && (
              <Typography variant="body2" color="text.secondary">
                {fuel.litresLeft} L left
              </Typography>
            )}
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 10,
              borderRadius: 1,
              mb: 2,
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #38bdf8, #22d3ee)',
              },
            }}
          />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No fuel level in current telemetry. Ensure the device reports fuel % (OBD or sensor).
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        Capacity: {fuel.capacityL != null ? `${fuel.capacityL} L` : '—'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Est. range: {fuel.rangeKm != null ? `${fuel.rangeKm} km` : '—'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
        <Typography variant="body2" color="text.secondary" component="span">
          Consumption: {fuel.lPer100km != null ? `${fuel.lPer100km} L/100km` : '—'}
        </Typography>
        {fuel.lPer100km != null && (
          <TrendingDownIcon sx={{ fontSize: 16, opacity: 0.5 }} color="success" />
        )}
      </Box>
    </Box>
  );
}
