import { Box, Button, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getIgnitionPhrase, getMotionDurationLabel, getMotionLabel } from '../../fleet/vehicleDetail/vehicleMotionStatus.js';
import useMotionDurationTick from '../../fleet/vehicleDetail/useMotionDurationTick.js';
import { devicesActions } from '../../store';
import { STALE_FIX_MS } from '../../main/fleet/vehicleOperationalIndicators.js';

dayjs.extend(relativeTime);

function VehicleRow({ row }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const now = useMotionDurationTick();
  const { display, position, state, hasProblem } = row;

  const dotColor = hasProblem
    ? theme.palette.error.main
    : state === 'moving'
      ? theme.palette.success.main
      : state === 'idle'
        ? theme.palette.warning.main
        : theme.palette.text.disabled;

  // position.attributes (ignition/speed) only updates when a new fix lands —
  // it can be arbitrarily older than the device's own online heartbeat, so
  // don't present it as current without checking fixTime age (same
  // STALE_FIX_MS threshold already used for the "stale fix" indicator).
  const fixAgeMs = position?.fixTime ? now - new Date(position.fixTime).getTime() : null;
  const isFixFresh = fixAgeMs != null && fixAgeMs <= STALE_FIX_MS;

  const speedKmh = position && state === 'moving' && isFixFresh
    ? Math.round(Number(position.speed || 0) * 1.852)
    : null;
  const durationLabel = getMotionDurationLabel(row.activityState, now);
  // Label always reflects the live-computed state (row.state), never the
  // possibly-stale persisted record — a synthetic { state } avoids relying
  // on activityState here, since DashboardPage nulls it out on mismatch.
  const motionLabel = getMotionLabel({ state });
  const ignition = state !== 'offline' && isFixFresh ? getIgnitionPhrase(position?.attributes) : null;
  const staleTelemetry = state !== 'offline' && !isFixFresh;
  const lastSeen = state === 'offline' && row.device?.lastUpdate
    ? `Last seen ${dayjs(row.device.lastUpdate).fromNow()}`
    : null;

  const parts = [];
  if (speedKmh != null) parts.push(`${speedKmh} km/h`);
  if (durationLabel) parts.push(`${motionLabel} ${durationLabel}`);
  else parts.push(motionLabel);
  if (ignition) parts.push(ignition);
  if (staleTelemetry) parts.push('Stale GPS fix');
  if (lastSeen) parts.push(lastSeen);

  const deviceId = row.device?.id;
  const clickable = Boolean(deviceId);
  const openOnMap = () => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/map');
  };

  return (
    <Box
      onClick={clickable ? openOnMap : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.85,
        borderBottom: 1,
        borderColor: 'divider',
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <Box sx={{ width: 8, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dotColor }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
          {display.primary}
        </Typography>
        <Typography noWrap sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
          {parts.join(' · ')}
        </Typography>
      </Box>
      {hasProblem && (
        <WarningAmberRoundedIcon sx={{ fontSize: '1rem', color: theme.palette.error.main, flexShrink: 0 }} />
      )}
    </Box>
  );
}

/** Live Fleet — a handful of real vehicles (not aggregate cards), prioritized problems-first. */
export default function LiveFleetList({ rows = [] }) {
  const navigate = useNavigate();

  return (
    <Box>
      {rows.length === 0 ? (
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', py: 1 }}>
          No vehicles to show
        </Typography>
      ) : (
        rows.map((row) => <VehicleRow key={row.device.id} row={row} />)
      )}
      <Button
        size="small"
        fullWidth
        onClick={() => navigate('/fleet/vehicles')}
        endIcon={<ArrowOutwardIcon sx={{ fontSize: '0.85rem' }} />}
        sx={{ justifyContent: 'space-between', mt: 1, fontSize: '0.78rem' }}
      >
        View all vehicles
      </Button>
    </Box>
  );
}
