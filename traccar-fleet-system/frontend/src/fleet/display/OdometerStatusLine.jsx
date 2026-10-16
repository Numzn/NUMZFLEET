import { Alert, Box, Typography } from '@mui/material';
import useMotionDurationTick from '../vehicleDetail/useMotionDurationTick.js';
import { describeOdometerStatus } from './odometerStatus.js';

const fmtKm = (km) => {
  const n = Number(km);
  return n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1);
};

/**
 * The vehicle's odometer with who vouches for it and how old the reading behind it is, straight from the
 * backend's resolved provenance (vehicle engine `registry`). When the value is not settled — provisional,
 * awaiting a tracker, a reading held for review, or an old last reading — the reasons are listed in a
 * warning so nobody mistakes a carried-over or stale figure for a live one.
 *
 * @param {{ registry: object|null|undefined, sx?: object }} props
 */
export default function OdometerStatusLine({ registry, sx }) {
  const now = useMotionDurationTick();
  if (!registry || registry.odometerKm == null || !Number.isFinite(Number(registry.odometerKm))) return null;

  const status = describeOdometerStatus(registry, now);
  const headline = (
    <>
      <strong>{`Odometer ${fmtKm(registry.odometerKm)} km`}</strong>
      {` · ${status.label}`}
      {status.age ? ` · last reading ${status.age}` : ''}
    </>
  );

  if (status.attention) {
    return (
      <Alert severity="warning" sx={sx}>
        <Typography variant="body2">{headline}</Typography>
        {status.details.map((line) => (
          <Typography key={line} variant="caption" display="block">{line}</Typography>
        ))}
      </Alert>
    );
  }

  return (
    <Box sx={sx}>
      <Typography variant="body2" color="text.secondary">{headline}</Typography>
      {status.details.map((line) => (
        <Typography key={line} variant="caption" color="text.secondary" display="block">{line}</Typography>
      ))}
    </Box>
  );
}
