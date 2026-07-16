import { Box, Typography } from '@mui/material';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import useVehicleFuelTrends from './hooks/useVehicleFuelTrends.js';
import { formatZmw } from '../../operationSessions/utils/formatters.js';

function Tile({ label, value }) {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export default function FuelTrendsCard({ deviceId }) {
  const { loading, trends } = useVehicleFuelTrends(deviceId);

  return (
    <Box sx={vehicleWorkspaceCardSx}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Fuel Trends
      </Typography>

      {loading && (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      )}

      {!loading && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' },
            gap: 2,
          }}
        >
          <Tile label="Monthly Spend" value={trends?.monthlySpendZmw != null ? formatZmw(trends.monthlySpendZmw) : '—'} />
          <Tile
            label="Avg. Fuel Economy"
            value={trends?.averageEconomyKmPerL != null ? `${trends.averageEconomyKmPerL.toFixed(1)} km/L` : '—'}
          />
          <Tile
            label="Avg. Litres / Fill"
            value={trends?.averageLitresPerFill != null ? `${trends.averageLitresPerFill.toFixed(1)} L` : '—'}
          />
          <Tile
            label="Cost / km"
            value={trends?.costPerKmZmw != null ? `ZMW ${trends.costPerKmZmw.toFixed(2)}` : '—'}
          />
          <Tile
            label="Avg. Distance Between Refuels"
            value={trends?.averageDistanceBetweenRefuelsKm != null ? `${Number(trends.averageDistanceBetweenRefuelsKm).toLocaleString()} km` : '—'}
          />
        </Box>
      )}
    </Box>
  );
}
