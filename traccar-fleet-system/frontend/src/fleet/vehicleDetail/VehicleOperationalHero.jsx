import { useId } from 'react';
import {
  Box,
  Button,
  Divider,
  LinearProgress,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DirectionsCarFilledIcon from '@mui/icons-material/DirectionsCarFilled';
import PlayArrowFilledIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { vehicleTypeLabel } from './vehicleDetailSections.js';
import { vehicleHeroSx } from './dashboardCardSx.js';

dayjs.extend(relativeTime);

/** Semi-circular speed gauge (SVG). */
function SpeedGauge({ speedKph, maxKph = 180, gradientId }) {
  const v = speedKph != null && Number.isFinite(speedKph) ? Math.max(0, speedKph) : 0;
  const pct = Math.min(1, v / maxKph);
  const angle = Math.PI * pct;
  const x = 100 + 80 * Math.cos(Math.PI - angle);
  const y = 100 - 80 * Math.sin(Math.PI - angle);
  const gid = gradientId || 'spdG-default';
  return (
    <Box sx={{ width: 200, mx: 'auto' }}>
      <svg viewBox="0 0 200 120" width="100%" height="120">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          opacity={0.15}
        />
        <path
          d={`M 20 100 A 80 80 0 0 1 ${x} ${y}`}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <text x="100" y="95" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight={700}>
          {Math.round(v)}
        </text>
        <text x="100" y="112" textAnchor="middle" fill="currentColor" fontSize="11" opacity={0.7}>
          km/h
        </text>
      </svg>
    </Box>
  );
}

export default function VehicleOperationalHero({
  vehicle,
  fuel,
  telemetry,
  motionLabel,
  ignitionPhrase,
  groupName,
  deviceId,
}) {
  const navigate = useNavigate();
  const gradientId = `hero-spd-${useId().replace(/:/g, '')}`;
  const status = vehicle?.device?.status;
  const online = status === 'online';
  const title =
    vehicle?.plateNumber?.trim() || vehicle?.name || vehicle?.device?.name || 'Vehicle';
  const modelName = vehicle?.name || vehicle?.device?.name;
  const typeLabel = vehicleTypeLabel(vehicle?.fleetConfig?.vehicleType);
  const displayVehicleLabel = vehicle?.name || vehicle?.device?.name || 'Vehicle';

  const speed = telemetry?.speedKph;
  const limit = telemetry?.speedLimitKph != null ? telemetry.speedLimitKph : 100;
  const dist = telemetry?.totalDistance;

  const liveParts = [];
  if (online) {
    liveParts.push('Online', motionLabel);
  } else {
    liveParts.push(status === 'offline' ? 'Offline' : status || 'Unknown');
  }
  if (online && ignitionPhrase) liveParts.push(ignitionPhrase);
  const statusLine = liveParts.filter(Boolean).join(' • ');

  let fuelLine = 'Fuel unknown';
  if (fuel?.levelPct != null) {
    const pct = Math.round(Math.max(0, Math.min(100, fuel.levelPct)));
    fuelLine =
      fuel.rangeKm != null ? `Fuel ${pct}% • Range ${fuel.rangeKm} km` : `Fuel ${pct}%`;
  }

  const metaParts = [modelName, typeLabel, groupName].filter(Boolean);
  const dedupedMeta = [...new Set(metaParts)];

  const fixIso = telemetry?.fixTime || vehicle?.device?.lastUpdate;
  const relativeUpdated = fixIso ? dayjs(fixIso).fromNow() : '—';
  const absoluteUpdated =
    fixIso &&
    (() => {
      try {
        return new Date(fixIso).toLocaleString();
      } catch {
        return fixIso;
      }
    })();

  return (
    <Box sx={[vehicleHeroSx, { mb: 1.5 }]}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/fleet/vehicles')}
            sx={{ alignSelf: 'flex-start', textTransform: 'none', color: 'primary.light' }}
          >
            Back to Vehicles
          </Button>
          <Typography
            variant="h4"
            component="h1"
            fontWeight={800}
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem' },
              letterSpacing: '0.02em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: online ? 'success.main' : 'text.secondary',
            }}
          >
            {statusLine || '—'}
          </Typography>
          <Typography variant="body1" fontWeight={600}>
            {fuelLine}
          </Typography>
          {dedupedMeta.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {dedupedMeta.join(' • ')}
            </Typography>
          )}
          <Tooltip title={absoluteUpdated || ''}>
            <Typography variant="caption" color="text.secondary" component="span">
              Updated {relativeUpdated}
            </Typography>
          </Tooltip>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Trips
          </Typography>
          {deviceId != null && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlayArrowFilledIcon />}
              onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Replay
            </Button>
          )}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
            gap: 3,
            alignItems: 'center',
            mt: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                alignItems: 'stretch',
              }}
            >
              <Box
                sx={{
                  borderRadius: 2,
                  minHeight: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: (t) =>
                    `linear-gradient(160deg, ${t.palette.primary.dark}33 0%, ${t.palette.grey[900]} 100%)`,
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <DirectionsCarFilledIcon sx={{ fontSize: 72, color: 'primary.light', opacity: 0.85 }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {typeLabel && `${typeLabel} · `}
                  {displayVehicleLabel}
                </Typography>
                {dist != null && (
                  <Typography variant="body2">
                    Distance (device):{' '}
                    <strong>
                      {dist >= 500 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`}
                    </strong>
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  No active trip — route legs will appear when trip sessions are linked.
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box>
            <SpeedGauge speedKph={speed} maxKph={180} gradientId={gradientId} />
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Current trip
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  No active leg
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={0}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': { borderRadius: 4 },
                }}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Speed limit (reference): {limit} km/h
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
