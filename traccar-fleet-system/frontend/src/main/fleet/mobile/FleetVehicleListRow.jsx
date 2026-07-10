import { Box, ListItemButton, Typography } from '@mui/material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useVehicleDisplayContext } from '../../../fleet/display/VehicleDisplayRegistryContext';
import {
  getMotionDurationLabel,
  getMotionLabel,
} from '../../../fleet/vehicleDetail/vehicleMotionStatus.js';
import { resolveLiveActivityState } from '../../../fleet/vehicleDetail/resolveLiveActivityState.js';
import useMotionDurationTick from '../../../fleet/vehicleDetail/useMotionDurationTick.js';
import { STATUS_TINT } from './fleetMobileCardSx';

dayjs.extend(relativeTime);

const FleetVehicleListRow = ({
  device,
  position,
  selected,
  onSelect,
}) => {
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const display = getDisplayForDevice(device.id, device);
  const motionNow = useMotionDurationTick();

  // Live state is the current-state authority (see resolveLiveActivityState.js
  // for why the persisted activityState record can drift arbitrarily far from
  // reality). The persisted record is only used below for duration, and only
  // when it still agrees with this live state.
  const key = resolveLiveActivityState({
    deviceStatus: device.status,
    deviceLastUpdate: device.lastUpdate,
    positionSpeed: position?.speed != null ? Number(position.speed) : null,
    now: motionNow,
  });
  const tint = STATUS_TINT[key];

  const persistedState = display.activityState;
  const durationState = persistedState?.state === key ? persistedState : null;
  const motionLabel = getMotionLabel({ state: key });
  const motionDuration = getMotionDurationLabel(durationState, motionNow);

  let statusText = motionDuration ? `${motionLabel} • ${motionDuration}` : motionLabel;
  if (key === 'offline' && device.lastUpdate) {
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
