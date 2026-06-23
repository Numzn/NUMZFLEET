import { Box, ListItemButton, Typography } from '@mui/material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useVehicleDisplayContext } from '../../../fleet/display/VehicleDisplayRegistryContext';
import { getMotionDurationLabel, getMotionLabel } from '../../../fleet/vehicleDetail/vehicleMotionStatus.js';
import { STATUS_TINT } from './fleetMobileCardSx';

dayjs.extend(relativeTime);

function statusKey(device, position) {
  if (device.status !== 'online') return 'offline';
  return position && Number(position.speed) > 0 ? 'moving' : 'idle';
}

const FleetVehicleListRow = ({
  device,
  position,
  selected,
  onSelect,
}) => {
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const display = getDisplayForDevice(device.id, device);

  const key = statusKey(device, position);
  const tint = STATUS_TINT[key];

  const motionLabel = getMotionLabel(device.status, position?.speed);
  const motionDuration = device.status === 'online'
    ? getMotionDurationLabel(device.id, device.status, position?.speed)
    : null;

  let statusText = motionDuration ? `${motionLabel} • ${motionDuration}` : motionLabel;
  if (device.status !== 'online' && device.lastUpdate) {
    statusText = `Offline • ${dayjs(device.lastUpdate).fromNow()}`;
  }

  return (
    <ListItemButton
      selected={selected}
      onClick={() => onSelect(device.id)}
      aria-selected={selected}
      sx={{
        py: 0.75,
        px: 'var(--space-3)',
        minHeight: 44,
        borderRadius: 0,
        borderLeft: selected ? `3px solid ${tint.fg}` : '3px solid transparent',
        '&.Mui-selected': {
          bgcolor: 'var(--surface-workspace)',
        },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          noWrap
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            lineHeight: 1.25,
            color: 'var(--color-text-primary)',
          }}
        >
          {display.primary}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.15 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tint.fg, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: tint.fg }}>
            {statusText}
          </Typography>
        </Box>
      </Box>
    </ListItemButton>
  );
};

export default FleetVehicleListRow;
