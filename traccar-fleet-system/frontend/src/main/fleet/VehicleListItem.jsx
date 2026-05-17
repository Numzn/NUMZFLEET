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
import { getIgnitionPhrase, getMotionLabel } from '../../fleet/vehicleDetail/vehicleMotionStatus.js';

dayjs.extend(relativeTime);

/** Compact numeric distance for display (no suffix). */
function distanceKmNumber(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  return n;
}

/** Single right-column insight: operational “today” framing (same Traccar distance field as before). */
function formatDistanceTodayInsight(raw) {
  const n = distanceKmNumber(raw);
  if (n == null) return null;
  if (n <= 0) return '0 km today';
  if (n >= 100) return `${Math.round(n)} km today`;
  if (n >= 10) return `${n.toFixed(1)} km today`;
  const rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - Math.round(n)) < 1e-6) return `${Math.round(n)} km today`;
  return `${n.toFixed(1)} km today`;
}

function pickRightInsight({ device, position, todayDistInsight, fixRel }) {
  if (device.status === 'offline') {
    if (fixRel) return `Last seen ${fixRel}`;
    if (device.lastUpdate) return `Last seen ${dayjs(device.lastUpdate).fromNow()}`;
    return null;
  }
  if (todayDistInsight) return todayDistInsight;
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

  const speedKmh = position ? Math.round(Number(position.speed || 0) * 1.852) : null;
  const motionDotColor = device.status !== 'online'
    ? theme.palette.error.main
    : (position && Number(position.speed) > 0 ? theme.palette.success.main : theme.palette.warning.main);

  let motionLabel = getMotionLabel(device.status, position?.speed);

  const fixRel = position?.fixTime ? dayjs(position.fixTime).fromNow() : null;

  const rawDist = position?.attributes?.distance ?? device.attributes?.distance;
  const todayDistInsight = formatDistanceTodayInsight(rawDist);

  const address = position?.address?.trim?.() || '';
  const ign = device.status === 'online' ? getIgnitionPhrase(position?.attributes) : null;

  const telemetryParts = [];
  if (device.status === 'online') {
    if (speedKmh != null) telemetryParts.push(`${speedKmh} km/h`);
    if (ign) telemetryParts.push(ign);
    if (fixRel) telemetryParts.push(fixRel);
  } else {
    telemetryParts.push('Offline');
  }
  const telemetryLine = telemetryParts.join(' · ');

  const insight = pickRightInsight({
    device,
    position,
    todayDistInsight,
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
          py: 0.45,
          px: 0.5,
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
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: 800,
                    fontSize: '0.8125rem',
                    lineHeight: 1.2,
                    color: 'text.primary',
                  }}
                >
                  {device.name}
                </Typography>
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
                  {motionLabel}
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
              {address ? (
                <Typography
                  variant="caption"
                  noWrap
                  title={address}
                  sx={{
                    display: 'block',
                    mt: 0.08,
                    fontSize: '0.62rem',
                    lineHeight: 1.3,
                    color: 'text.secondary',
                    opacity: 0.75,
                  }}
                >
                  {address}
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
