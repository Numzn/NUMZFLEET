import { Box, Chip, Typography } from '@mui/material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { vehicleModuleSx } from './dashboardCardSx.js';
import { getIgnitionPhrase } from './vehicleMotionStatus.js';

dayjs.extend(relativeTime);

export default function LiveStatusModule({ vehicle, telemetry, livePosition }) {
  const online = vehicle?.device?.status === 'online';
  const speedKph = telemetry?.speedKph;
  const fixRel = telemetry?.fixTime ? dayjs(telemetry.fixTime).fromNow() : null;
  const address = livePosition?.address?.trim?.() || '';
  const lat = livePosition?.latitude;
  const lon = livePosition?.longitude;
  const coords =
    lat != null && lon != null ? `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}` : null;
  const ign = online ? getIgnitionPhrase(livePosition?.attributes) : null;

  return (
    <Box sx={[vehicleModuleSx, { height: 'auto' }]}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Live status
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        What is this vehicle doing right now?
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, alignItems: 'center' }}>
        <Chip size="small" label={`Speed ${speedKph != null ? `${Math.round(speedKph)} km/h` : '—'}`} />
        <Chip size="small" label={ign || 'Ignition unknown'} variant="outlined" />
        <Chip
          size="small"
          label={telemetry?.fixTime ? `Last fix ${fixRel || '—'}` : 'No recent fix'}
          variant="outlined"
        />
        <Chip
          size="small"
          color={online ? 'success' : 'default'}
          label={vehicle?.device?.status === 'online' ? 'Connected' : vehicle?.device?.status || 'Unknown'}
        />
      </Box>
      {(address || coords) && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Location
          </Typography>
          <Typography variant="body2">
            {address || coords || '—'}
          </Typography>
          {address && coords && (
            <Typography variant="caption" color="text.secondary">
              {coords}
            </Typography>
          )}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
        Trip sessions will surface active trip state when linked to operations.
      </Typography>
    </Box>
  );
}
