import {
  Box, Button, Chip, Typography, Divider,
} from '@mui/material';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { formatDistance } from '../../common/util/formatter';
import { useAttributePreference } from '../../common/util/preferences';
import { useTranslation } from '../../common/components/LocalizationProvider';

function formatDue(item, { distanceUnit, t }) {
  if (item.unknown || item.remaining == null) return 'Awaiting odometer data';
  if (item.isTime) {
    const days = Math.round(item.remaining / 86400000);
    return `Due ${dayjs(item.nextDue).format('MMM D, YYYY')} · ${days}d`;
  }
  if (item.type === 'totalDistance') {
    return `${formatDistance(item.remaining, distanceUnit, t)} to next service`;
  }
  if (item.type === 'hours') {
    return `${Math.round(item.remaining / 3600000)} h to next service`;
  }
  return `${Math.round(item.remaining)} to next service`;
}

export default function VehicleMaintenanceCard({ items, loading, deviceId }) {
  const navigate = useNavigate();
  const t = useTranslation();
  const distanceUnit = useAttributePreference('distanceUnit');

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Maintenance schedule
          </Typography>
        </Box>
        {deviceId ? (
          <Button
            size="small"
            onClick={() => navigate(`/settings/maintenances?deviceId=${deviceId}`)}
          >
            Manage
          </Button>
        ) : null}
      </Box>

      {loading && (
        <Typography variant="body2" color="text.secondary">Loading schedules…</Typography>
      )}

      {!loading && items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No maintenance schedules linked to this vehicle.
        </Typography>
      )}

      {!loading && items.map((item, idx) => (
        <Box key={item.id}>
          {idx > 0 ? <Divider sx={{ my: 1 }} /> : null}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDue(item, { distanceUnit, t })}
              </Typography>
            </Box>
            {item.dueSoon ? (
              <Chip size="small" color="warning" label="Due soon" />
            ) : null}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
