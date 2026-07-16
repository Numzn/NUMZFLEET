import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import useVehicleFuelHistory from './hooks/useVehicleFuelHistory.js';
import { formatLitres, formatZmw } from '../../operationSessions/utils/formatters.js';

const HISTORY_LIMIT = 5;

function formatDate(t) {
  if (!t) return '—';
  try {
    return new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

export default function RecentFuelHistoryCard({ deviceId }) {
  const navigate = useNavigate();
  const { loading, history } = useVehicleFuelHistory(deviceId, HISTORY_LIMIT);

  return (
    <Box sx={vehicleWorkspaceCardSx}>
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Recent Fuel History
        </Typography>
      </Box>

      {loading && (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      )}

      {!loading && history.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No fueling sessions recorded yet.
        </Typography>
      )}

      {!loading && history.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {history.map((row, index) => (
            <Box
              key={row.refuelId}
              onClick={() => navigate(`/fleet/operation-sessions/fuel/${row.sessionId}`)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                py: 1.25,
                borderTop: index === 0 ? 'none' : '1px solid var(--surface-border)',
                cursor: row.sessionId != null ? 'pointer' : 'default',
                '&:hover': row.sessionId != null ? { bgcolor: 'var(--surface-workspace)' } : undefined,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {formatDate(row.date)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.odometerKm != null ? `${Number(row.odometerKm).toLocaleString()} km` : 'Odometer unavailable'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" fontWeight={600}>
                  {formatLitres(row.litres)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.totalCost != null ? formatZmw(row.totalCost) : '—'}
                  {row.economyKmPerL != null ? ` · ${row.economyKmPerL.toFixed(1)} km/L` : ''}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
