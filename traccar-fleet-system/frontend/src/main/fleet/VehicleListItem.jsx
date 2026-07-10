import {
  Box,
  IconButton,
  ListItemButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useDispatch } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { devicesActions } from '../../store';
import DeviceQuickActions from './DeviceQuickActions';
import { getIgnitionPhrase, getMotionDurationLabel, getMotionLabel } from '../../fleet/vehicleDetail/vehicleMotionStatus.js';
import { resolveLiveActivityState } from '../../fleet/vehicleDetail/resolveLiveActivityState.js';
import useMotionDurationTick from '../../fleet/vehicleDetail/useMotionDurationTick.js';
import { useVehicleDisplayContext } from '../../fleet/display/VehicleDisplayRegistryContext';
import VehicleLocationLine from '../../common/components/VehicleLocationLine';
import { STALE_FIX_MS } from './vehicleOperationalIndicators.js';

dayjs.extend(relativeTime);

/**
 * Single right-column insight: canonical odometer (fuel-api resolveOdometerKm),
 * NOT daily mileage — no day-start baseline exists yet (separate checkpoint),
 * so this must not be labeled "today".
 */
function formatOdometerInsight(odometerKm) {
  if (odometerKm == null || !Number.isFinite(Number(odometerKm))) return null;
  const n = Number(odometerKm);
  if (n >= 100) return `Odometer ${Math.round(n).toLocaleString()} km`;
  return `Odometer ${n.toFixed(1)} km`;
}

function pickRightInsight({ device, isOffline, odometerInsight, fixRel }) {
  if (isOffline) {
    if (fixRel) return `Last seen ${fixRel}`;
    if (device.lastUpdate) return `Last seen ${dayjs(device.lastUpdate).fromNow()}`;
    return null;
  }
  if (odometerInsight) return odometerInsight;
  return null;
}

const VehicleListItem = ({
  device,
  position,
  selected,
  onSelect,
  onHover,
  fleetVehicleId,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const display = getDisplayForDevice(device.id, device);
  const motionNow = useMotionDurationTick();

  // Live state is the current-state authority (see resolveLiveActivityState.js
  // for why the persisted activityState record can drift arbitrarily far from
  // reality). The persisted record is only used below for duration, and only
  // when it still agrees with this live state.
  const liveState = resolveLiveActivityState({
    deviceStatus: device.status,
    deviceLastUpdate: device.lastUpdate,
    positionSpeed: position?.speed != null ? Number(position.speed) : null,
    now: motionNow,
  });
  const isOffline = liveState === 'offline';
  const persistedState = display.activityState;
  const durationState = persistedState?.state === liveState ? persistedState : null;
  // position.attributes (ignition/speed) only updates when a new fix lands —
  // gate on the same STALE_FIX_MS threshold used elsewhere so an old fix
  // isn't presented as current telemetry.
  const fixAgeMs = position?.fixTime ? motionNow - new Date(position.fixTime).getTime() : null;
  const isFixFresh = fixAgeMs != null && fixAgeMs <= STALE_FIX_MS;
  const speedKmh = position && isFixFresh ? Math.round(Number(position.speed || 0) * 1.852) : null;
  const motionDotColor = isOffline
    ? theme.palette.error.main
    : (liveState === 'moving' ? theme.palette.success.main : theme.palette.warning.main);

  const motionLabel = getMotionLabel({ state: liveState });
  const motionDuration = getMotionDurationLabel(durationState, motionNow);
  const motionDisplay = motionDuration ? `${motionLabel} ${motionDuration}` : motionLabel;

  const fixRel = position?.fixTime ? dayjs(position.fixTime).fromNow() : null;

  const odometerInsight = formatOdometerInsight(display.odometerKm);

  const hasFix = position?.latitude != null && position?.longitude != null;
  const ign = !isOffline && isFixFresh ? getIgnitionPhrase(position?.attributes) : null;

  const telemetryParts = [];
  if (!isOffline) {
    if (speedKmh != null) telemetryParts.push(`${speedKmh} km/h`);
    if (ign) telemetryParts.push(ign);
    if (fixRel) telemetryParts.push(fixRel);
    if (!isFixFresh && position) telemetryParts.push('Stale GPS fix');
  } else {
    telemetryParts.push('Offline');
  }
  const telemetryLine = telemetryParts.join(' · ');

  const insight = pickRightInsight({
    device,
    isOffline,
    odometerInsight,
    fixRel,
  });

  const expansionBg = theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.02)';

  return (
    <Box sx={{ width: '100%' }}>
      <ListItemButton
        selected={selected}
        onClick={() => onSelect(device.id)}
        onMouseEnter={() => onHover(device.id)}
        onMouseLeave={() => onHover(null)}
        sx={{
          alignItems: 'stretch',
          py: 'var(--space-3)',
          px: 'var(--space-3)',
          mx: 0.25,
          my: 0,
          borderRadius: selected ? '4px 4px 0 0' : 0,
          borderLeft: '2px solid',
          borderLeftColor: selected ? 'primary.main' : 'transparent',
          borderTop: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          bgcolor: selected
            ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.selected')
            : 'transparent',
          transition: theme.transitions.create(['background-color', 'border-color'], {
            duration: theme.transitions.duration.shortest,
          }),
          '&:hover': {
            bgcolor: selected
              ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'action.selected')
              : 'action.hover',
          },
          '&.Mui-selected': {
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'action.selected',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 0.5, width: '100%', minWidth: 0 }}>
          <Box sx={{ pt: 0.35, flexShrink: 0, width: 8 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: motionDotColor,
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 0.75 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 0.75, minWidth: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.8125rem',
                      lineHeight: 1.2,
                      color: 'text.primary',
                    }}
                  >
                    {display.primary}
                  </Typography>
                  {display.secondary ? (
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{
                        display: 'block',
                        fontSize: '0.62rem',
                        lineHeight: 1.2,
                        color: 'text.secondary',
                        opacity: theme.palette.mode === 'dark' ? 0.72 : 0.78,
                      }}
                    >
                      {display.secondary}
                    </Typography>
                  ) : null}
                </Box>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    flexShrink: 0,
                    fontWeight: 500,
                    fontSize: '0.62rem',
                    lineHeight: 1.25,
                    color: 'text.secondary',
                    opacity: theme.palette.mode === 'dark' ? 0.72 : 0.78,
                  }}
                >
                  {motionDisplay}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  display: 'block',
                  mt: 0.1,
                  fontSize: '0.65rem',
                  lineHeight: 1.3,
                  color: 'text.secondary',
                  opacity: theme.palette.mode === 'dark' ? 0.88 : 0.9,
                  fontWeight: 600,
                }}
              >
                {telemetryLine || '—'}
              </Typography>
              {hasFix ? (
                <Typography
                  component="div"
                  variant="caption"
                  noWrap
                  sx={{
                    display: 'block',
                    mt: 0.08,
                    fontSize: '0.62rem',
                    lineHeight: 1.3,
                    color: 'text.secondary',
                    opacity: 0.75,
                  }}
                >
                  <VehicleLocationLine position={position} showCoordsFallback={false} />
                </Typography>
              ) : null}
            </Box>
            {insight ? (
              <Typography
                variant="caption"
                textAlign="right"
                sx={{
                  flexShrink: 0,
                  alignSelf: 'flex-start',
                  maxWidth: '40%',
                  fontSize: '0.595rem',
                  lineHeight: 1.28,
                  color: 'text.secondary',
                  opacity: theme.palette.mode === 'dark' ? 0.7 : 0.76,
                  fontWeight: 500,
                  pt: 0.12,
                  letterSpacing: '0.01em',
                }}
              >
                {insight}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </ListItemButton>
      {selected ? (
        <Box
          sx={{
            mx: 0.25,
            mb: 0.15,
            px: 0.45,
            pt: 0.22,
            pb: 0.38,
            borderLeft: '2px solid',
            borderLeftColor: 'primary.main',
            borderRadius: '0 0 4px 4px',
            bgcolor: expansionBg,
            borderBottom: '1px solid',
            borderBottomColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, minWidth: 0 }}>
            <DeviceQuickActions
              device={device}
              position={position}
              fleetVehicleId={fleetVehicleId}
              justifyContent="flex-start"
            />
            <IconButton
              size="small"
              onClick={() => dispatch(devicesActions.selectId(null))}
              aria-label="Clear selection"
              sx={{ p: 0.2 }}
            >
              <CloseIcon sx={{ fontSize: '0.95rem' }} />
            </IconButton>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

export default VehicleListItem;
