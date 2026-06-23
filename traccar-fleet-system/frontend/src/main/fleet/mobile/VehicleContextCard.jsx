import {
  Box,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import { useVehicleDisplayContext } from '../../../fleet/display/VehicleDisplayRegistryContext';
import { getMotionDurationLabel, getMotionLabel } from '../../../fleet/vehicleDetail/vehicleMotionStatus.js';
import VehicleLocationLine from '../../../common/components/VehicleLocationLine';
import DeviceQuickActions from '../DeviceQuickActions';
import { getGpsStaleWarning } from './gpsStaleWarning';
import { formatTodayDistanceLabel, resolveTodayDistanceRaw } from './vehicleTodayDistance';
import { STATUS_TINT } from './fleetMobileCardSx';

function statusKey(device, position) {
  if (device.status !== 'online') return 'offline';
  return position && Number(position.speed) > 0 ? 'moving' : 'idle';
}

const VehicleContextCard = ({
  device,
  position,
  fleetVehicleId,
  phone,
  onClose,
}) => {
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const display = getDisplayForDevice(device?.id, device);

  if (!device || !position) return null;

  const key = statusKey(device, position);
  const tint = STATUS_TINT[key];
  const motionLabel = getMotionLabel(device.status, position?.speed);
  const motionDuration = device.status === 'online'
    ? getMotionDurationLabel(device.id, device.status, position?.speed)
    : null;
  const statusText = motionDuration ? `${motionLabel} • ${motionDuration}` : motionLabel;
  const gpsStale = getGpsStaleWarning(position?.fixTime);
  const todayDistance = formatTodayDistanceLabel(resolveTodayDistanceRaw(position, device));
  const hasFix = position.latitude != null && position.longitude != null;

  return (
    <Paper
      elevation={6}
      role="region"
      aria-label="Selected vehicle"
      sx={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 'calc(var(--fleet-sheet-height, 0px) + 8px)',
        zIndex: 1001,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'var(--surface-border)',
        bgcolor: 'var(--surface-card)',
        p: 1.5,
        pointerEvents: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '0.9375rem', fontWeight: 800, lineHeight: 1.2 }}>
            {display.primary}
          </Typography>
          {display.secondary ? (
            <Typography noWrap sx={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', mt: 0.15 }}>
              {display.secondary}
            </Typography>
          ) : null}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tint.fg, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: tint.fg }}>
              {statusText}
            </Typography>
          </Box>
          {gpsStale ? (
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-warning)', mt: 0.35 }}>
              {`⚠ ${gpsStale}`}
            </Typography>
          ) : null}
          {hasFix ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, minWidth: 0 }}>
              <LocationOnOutlinedIcon sx={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              <Typography
                component="div"
                noWrap
                sx={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', minWidth: 0 }}
              >
                <VehicleLocationLine position={position} showCoordsFallback={false} />
              </Typography>
            </Box>
          ) : null}
          {todayDistance ? (
            <Typography sx={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', mt: 0.35 }}>
              {todayDistance}
            </Typography>
          ) : null}
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close selected vehicle" sx={{ mt: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ mt: 1 }}>
        <DeviceQuickActions
          variant="tracking"
          device={device}
          position={position}
          fleetVehicleId={fleetVehicleId}
          phone={phone}
        />
      </Box>
    </Paper>
  );
};

export default VehicleContextCard;
