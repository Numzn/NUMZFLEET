import { Box, Typography } from '@mui/material';
import { vehicleDashboardCardSx } from '../dashboardCardSx.js';
import { formatDistance } from '../../../common/util/formatter';

function formatDueShort(item, distanceUnit, t) {
  if (!item || item.unknown || item.remaining == null) return '—';
  if (item.isOverdue) return 'Due now';
  if (item.isTime) {
    const days = Math.round(item.remaining / 86400000);
    return `${days} days`;
  }
  if (item.type === 'totalDistance') {
    return formatDistance(item.remaining, distanceUnit, t);
  }
  return String(Math.round(item.remaining));
}

export default function VehicleServiceRemindersTimeline({
  maintenanceItems = [],
  odometerKm,
  distanceUnit,
  t,
}) {
  const sorted = [...maintenanceItems]
    .filter((i) => !i.unknown)
    .sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity))
    .slice(0, 4);

  const currentOdoMeters = odometerKm != null ? odometerKm * 1000 : null;

  return (
    <Box sx={vehicleDashboardCardSx}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Service Reminders
      </Typography>

      {currentOdoMeters != null && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 10,
              borderRadius: 1,
              bgcolor: 'primary.main',
              opacity: 0.4,
            }}
          />
          <Box>
            <Typography variant="body2" fontWeight={600}>Current mileage</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDistance(currentOdoMeters, distanceUnit, t)}
            </Typography>
          </Box>
        </Box>
      )}

      {sorted.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No scheduled services linked to this vehicle.
        </Typography>
      )}

      {sorted.map((item, idx) => (
        <Box key={item.id} sx={{ display: 'flex', gap: 1.5, mb: idx < sorted.length - 1 ? 2 : 0 }}>
          <Box
            sx={{
              width: 10,
              borderRadius: 1,
              bgcolor: item.isOverdue ? 'error.main' : item.dueSoon ? 'warning.main' : 'success.main',
              opacity: 0.7,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{item.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDueShort(item, distanceUnit, t)} remaining
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
