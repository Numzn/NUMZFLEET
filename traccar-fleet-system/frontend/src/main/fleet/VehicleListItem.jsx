import {
  Box,
  IconButton,
  ListItemButton,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useDispatch } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import DriverValue from '../../common/components/DriverValue';
import { devicesActions } from '../../store';
import DeviceQuickActions from './DeviceQuickActions';
import DeviceTelemetryPanel from './DeviceTelemetryPanel';
import getOperationalIndicators from './vehicleOperationalIndicators';

dayjs.extend(relativeTime);

function formatDurationShort(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

function formatDistanceKm(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  if (n >= 100) return `${Math.round(n)}km`;
  if (n >= 10) return `${n.toFixed(1)}km`;
  return `${n.toFixed(1)}km`;
}

const VehicleListItem = ({
  device,
  position,
  selected,
  onSelect,
  onHover,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const speedKmh = position ? Math.round(Number(position.speed || 0) * 1.852) : null;
  const motionDotColor = device.status !== 'online'
    ? theme.palette.error.main
    : (position && Number(position.speed) > 0 ? theme.palette.success.main : theme.palette.warning.main);

  let motionLabel = 'Offline';
  if (device.status === 'online') {
    motionLabel = position && Number(position.speed) > 0 ? 'Moving' : 'Idle';
  }

  const driverUid = device.attributes?.driverUniqueId;
  const plate = device.plateNumber || device.attributes?.plateNumber;
  const assetBits = [plate, device.category, device.model].filter(Boolean);
  const assetTail = assetBits.length ? assetBits.join(' · ') : (device.uniqueId || '');

  const fixRel = position?.fixTime ? dayjs(position.fixTime).fromNow() : null;
  const fixAgeMs = position?.fixTime ? Date.now() - new Date(position.fixTime).getTime() : null;
  const durationLabel = formatDurationShort(fixAgeMs);

  const rawDist = position?.attributes?.distance ?? device.attributes?.distance;
  const distLabel = formatDistanceKm(rawDist);

  const address = position?.address?.trim?.() || '';
  const destHint = device.attributes?.destination
    || position?.attributes?.destination
    || position?.attributes?.tripDestination;

  const indicators = getOperationalIndicators(device, position);
  const indicatorSuffix = indicators.length
    ? indicators.map((ind) => ind.label).join(' · ')
    : null;

  const identityRight = distLabel
    || (device.status === 'online' && motionLabel === 'Moving' && speedKmh != null ? `${speedKmh}km/h` : '—');

  const lineCurrent = address
    || (device.status === 'online' ? 'Position resolving…' : 'No live position');
  const lineDest = destHint
    || (fixRel ? `Last fix ${fixRel}` : (device.lastUpdate ? `Device ${dayjs(device.lastUpdate).fromNow()}` : null));

  const telemetryParts = [];
  if (durationLabel) telemetryParts.push(durationLabel);
  if (distLabel) telemetryParts.push(distLabel);
  telemetryParts.push(motionLabel);
  const telemetryCore = telemetryParts.join(' · ');

  const routeSecondary = Boolean(lineDest);

  const expansionBg = theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.03)';

  return (
    <Box sx={{ width: '100%' }}>
      <ListItemButton
        selected={selected}
        onClick={() => onSelect(device.id)}
        onMouseEnter={() => onHover(device.id)}
        onMouseLeave={() => onHover(null)}
        sx={{
          alignItems: 'stretch',
          py: 0.4,
          px: 0.75,
          mx: 0.65,
          my: 0.12,
          borderRadius: selected ? '4px 4px 0 0' : 1,
          border: '1px solid',
          borderColor: selected ? 'primary.main' : 'divider',
          borderLeftWidth: 2,
          borderLeftColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected
            ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'action.selected')
            : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'background.paper'),
          boxShadow: selected ? `inset 0 0 0 1px ${theme.palette.primary.main}22` : 'none',
          transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow', 'border-radius'], {
            duration: theme.transitions.duration.shortest,
          }),
          '&:hover': {
            bgcolor: selected
              ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'action.selected')
              : 'action.hover',
          },
          '&.Mui-selected': {
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'action.selected',
          },
        }}
      >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 0.75,
          minWidth: 0,
          width: '100%',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pt: 0.2,
            flexShrink: 0,
            width: 8,
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: motionDotColor,
              boxShadow: (t) => `0 0 0 1px ${t.palette.background.paper}`,
            }}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.2 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{
                flex: 1,
                minWidth: 0,
                fontWeight: 700,
                fontSize: '0.8125rem',
                lineHeight: 1.25,
                letterSpacing: '0.01em',
              }}
            >
              {device.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                flexShrink: 0,
                fontWeight: 700,
                fontSize: '0.6875rem',
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {identityRight}
            </Typography>
          </Box>

          <Typography
            variant="caption"
            noWrap
            sx={{
              fontSize: '0.6875rem',
              lineHeight: 1.3,
              color: 'text.secondary',
              opacity: 0.88,
            }}
          >
            {driverUid ? (
              <>
                <DriverValue driverUniqueId={driverUid} />
                {assetTail ? ` · ${assetTail}` : ''}
              </>
            ) : (
              assetTail || '—'
            )}
          </Typography>

          {routeSecondary ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 1.25,
                minWidth: 0,
                width: '100%',
              }}
            >
              <Typography
                variant="caption"
                noWrap
                title={lineCurrent}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '0.625rem',
                  lineHeight: 1.35,
                  color: 'text.secondary',
                  opacity: 0.9,
                }}
              >
                ○ {lineCurrent}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                title={lineDest}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '0.625rem',
                  lineHeight: 1.35,
                  color: 'text.secondary',
                  opacity: 0.75,
                }}
              >
                ○ {lineDest}
              </Typography>
            </Box>
          ) : (
            <Typography
              variant="caption"
              noWrap
              title={lineCurrent}
              sx={{
                fontSize: '0.625rem',
                lineHeight: 1.35,
                color: 'text.secondary',
                opacity: 0.88,
              }}
            >
              ○ {lineCurrent}
            </Typography>
          )}

          <Tooltip
            title={[durationLabel && `Since fix: ${durationLabel}`, distLabel && `Distance: ${distLabel}`, indicatorSuffix].filter(Boolean).join(' · ') || ''}
            placement="top"
            enterTouchDelay={400}
            disableHoverListener={!durationLabel && !distLabel && !indicatorSuffix}
          >
            <Typography
              component="div"
              variant="caption"
              sx={{
                fontSize: '0.6875rem',
                lineHeight: 1.35,
                fontWeight: 600,
                color: 'text.primary',
                opacity: 0.9,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.35,
                minWidth: 0,
              }}
            >
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {telemetryCore}
              </Box>
              {indicatorSuffix ? (
                <Box
                  component="span"
                  sx={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    color: indicators.some((i) => i.color === 'error')
                      ? 'error.main'
                      : indicators.some((i) => i.color === 'warning')
                        ? 'warning.main'
                        : 'text.secondary',
                  }}
                >
                  · {indicatorSuffix}
                </Box>
              ) : null}
            </Typography>
          </Tooltip>
        </Box>
      </Box>
    </ListItemButton>
    {selected ? (
      <Box
        sx={{
          mx: 0.65,
          mb: 0.5,
          px: 0.75,
          pt: 0.35,
          pb: 0.65,
          border: '1px solid',
          borderColor: 'primary.main',
          borderTopWidth: 0,
          borderLeftWidth: 2,
          borderLeftColor: 'primary.main',
          borderRadius: '0 0 4px 4px',
          bgcolor: expansionBg,
          boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}22`,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 0.25 }}>
          <IconButton
            size="small"
            onClick={() => dispatch(devicesActions.selectId(null))}
            aria-label="Clear selection"
            sx={{ mr: -0.5 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <DeviceQuickActions device={device} position={position} justifyContent="flex-start" />
        <DeviceTelemetryPanel position={position} />
      </Box>
    ) : null}
    </Box>
  );
};

export default VehicleListItem;
