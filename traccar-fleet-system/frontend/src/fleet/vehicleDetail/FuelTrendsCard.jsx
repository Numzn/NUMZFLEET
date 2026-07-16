import { Box, Typography } from '@mui/material';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import useVehicleFuelTrends from './hooks/useVehicleFuelTrends.js';
import { formatZmw } from '../../operationSessions/utils/formatters.js';

function Tile({ label, value }) {
  const empty = value == null;
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} color={empty ? 'text.disabled' : 'text.primary'}>
        {empty ? '—' : value}
      </Typography>
      <Typography variant="caption" color={empty ? 'text.disabled' : 'text.secondary'}>
        {label}
      </Typography>
    </Box>
  );
}

export default function FuelTrendsCard({ deviceId }) {
  const { loading, trends } = useVehicleFuelTrends(deviceId);

  return (
    <Box sx={vehicleWorkspaceCardSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <TrendingUpOutlinedIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>
          Fuel Trends
        </Typography>
      </Box>

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
          <Tile label="Monthly Spend" value={trends?.monthlySpendZmw != null ? formatZmw(trends.monthlySpendZmw) : null} />
          <Tile
            label="Avg. Fuel Economy"
            value={trends?.averageEconomyKmPerL != null ? `${trends.averageEconomyKmPerL.toFixed(1)} km/L` : null}
          />
          <Tile
            label="Avg. Litres / Fill"
            value={trends?.averageLitresPerFill != null ? `${trends.averageLitresPerFill.toFixed(1)} L` : null}
          />
          <Tile
            label="Cost / km"
            value={trends?.costPerKmZmw != null ? `ZMW ${trends.costPerKmZmw.toFixed(2)}` : null}
          />
          <Tile
            label="Avg. Distance Between Refuels"
            value={trends?.averageDistanceBetweenRefuelsKm != null ? `${Number(trends.averageDistanceBetweenRefuelsKm).toLocaleString()} km` : null}
          />
        </Box>
      )}
    </Box>
  );
}
