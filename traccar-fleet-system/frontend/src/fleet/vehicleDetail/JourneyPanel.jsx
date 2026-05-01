import { useId } from 'react';
import { Avatar, Box, LinearProgress, Typography } from '@mui/material';
import DirectionsCarFilledIcon from '@mui/icons-material/DirectionsCarFilled';
import { vehicleTypeLabel } from './vehicleDetailSections.js';
import { vehicleDashboardCardSx } from './dashboardCardSx.js';

/** Lightweight semi-circular speed gauge (SVG). */
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

export default function JourneyPanel({ vehicle, telemetry }) {
  const gradientId = `spd-${useId().replace(/:/g, '')}`;
  const speed = telemetry?.speedKph;
  const limit = telemetry?.speedLimitKph != null ? telemetry.speedLimitKph : 100;
  const dist = telemetry?.totalDistance;
  const driverName =
    vehicle?.device?.contact ||
    vehicle?.device?.driverName ||
    vehicle?.device?.attributes?.driverName ||
    null;
  const typeLabel = vehicleTypeLabel(vehicle?.fleetConfig?.vehicleType);
  const displayVehicleLabel = vehicle?.name || vehicle?.device?.name || 'Vehicle';

  return (
    <Box
      sx={[
        vehicleDashboardCardSx,
        {
          p: 2.5,
          height: 'auto',
          bgcolor: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(15, 23, 42, 0.72)'
              : t.palette.background.paper,
          backgroundImage: (t) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(145deg, rgba(30, 58, 138, 0.14) 0%, transparent 46%)'
              : undefined,
        },
      ]}
    >
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
        Trip overview
      </Typography>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.dark' }}>
              {(driverName || '?').charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {driverName || 'Driver'}
              </Typography>
              {!driverName && (
                <Typography variant="caption" color="text.secondary">
                  Set contact or driver in Traccar to show name here
                </Typography>
              )}
            </Box>
          </Box>
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
                Engine hours and route legs will appear when trip sessions are linked.
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
  );
}
