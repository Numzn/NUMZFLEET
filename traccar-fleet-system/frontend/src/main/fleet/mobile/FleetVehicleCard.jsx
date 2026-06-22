import { Box, Typography } from '@mui/material';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTheme } from '@mui/material/styles';
import { useVehicleDisplayContext } from '../../../fleet/display/VehicleDisplayRegistryContext';
import { getMotionDurationLabel, getMotionLabel } from '../../../fleet/vehicleDetail/vehicleMotionStatus.js';
import VehicleLocationLine from '../../../common/components/VehicleLocationLine';
import fleetDeviceIcon from '../fleetDeviceIcon.jsx';
import DeviceQuickActions from '../DeviceQuickActions';
import { STATUS_TINT, fleetVehicleCardSx } from './fleetMobileCardSx';

dayjs.extend(relativeTime);

function statusKey(device, position) {
  if (device.status !== 'online') return 'offline';
  return position && Number(position.speed) > 0 ? 'moving' : 'idle';
}

const FleetVehicleCard = ({
  device,
  position,
  selected,
  fleetVehicleId,
  phone,
  onSelect,
}) => {
  const theme = useTheme();
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const display = getDisplayForDevice(device.id, device);

  const key = statusKey(device, position);
  const tint = STATUS_TINT[key];

  const motionLabel = getMotionLabel(device.status, position?.speed);
  const motionDuration = device.status === 'online'
    ? getMotionDurationLabel(device.id, device.status, position?.speed)
    : null;

  let statusText = motionDuration ? `${motionLabel} · ${motionDuration}` : motionLabel;
  if (device.status !== 'online' && device.lastUpdate) {
    statusText = `Offline · ${dayjs(device.lastUpdate).fromNow()}`;
  }

  const hasFix = position?.latitude != null && position?.longitude != null;

  return (
    <Box
      onClick={() => onSelect(device.id)}
      sx={{
        ...fleetVehicleCardSx,
        cursor: 'pointer',
        borderColor: selected ? 'var(--color-primary)' : 'var(--surface-border)',
        boxShadow: selected ? 'inset 0 0 0 1px var(--color-primary)' : 'none',
        transition: 'border-color 0.15s ease',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', minWidth: 0 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: tint.bg,
            color: tint.fg,
            '& svg': { fontSize: '1.25rem' },
          }}
        >
          {fleetDeviceIcon(device)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 800,
              lineHeight: 1.2,
              color: 'var(--color-text-primary)',
            }}
          >
            {display.primary}
          </Typography>
          {display.secondary ? (
            <Typography
              noWrap
              sx={{
                fontSize: '0.65rem',
                lineHeight: 1.2,
                color: 'var(--color-text-secondary)',
                opacity: theme.palette.mode === 'dark' ? 0.72 : 0.78,
              }}
            >
              {display.secondary}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.35 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tint.fg, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: tint.fg }}>
              {statusText}
            </Typography>
          </Box>
        </Box>
      </Box>

      {hasFix ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <LocationOnOutlinedIcon sx={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <Typography
            component="div"
            noWrap
            sx={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', minWidth: 0 }}
          >
            <VehicleLocationLine position={position} showCoordsFallback={false} />
          </Typography>
        </Box>
      ) : null}

      <Box onClick={(e) => e.stopPropagation()}>
        <DeviceQuickActions
          variant="labeled"
          device={device}
          position={position}
          fleetVehicleId={fleetVehicleId}
          phone={phone}
        />
      </Box>
    </Box>
  );
};

export default FleetVehicleCard;
