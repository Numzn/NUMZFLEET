import { useEffect, useState } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';

const POLL_MS = 2 * 60 * 1000; // match server cache TTL

const Stat = ({ icon, value, label, color }) => (
  <Tooltip title={label} placement="bottom" arrow>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.6,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', color, fontSize: 14, lineHeight: 1 }}>
        {icon}
      </Box>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'text.primary', lineHeight: 1 }}
      >
        {value}
      </Typography>
    </Box>
  </Tooltip>
);

const FleetSummary = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch('/api/public/fleet-summary', { credentials: 'omit' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!cancelled && j && (j.totalVehicles > 0 || j.onlineVehicles > 0 || j.pendingFuelRequests > 0)) {
            setData(j);
          }
        })
        .catch(() => {});
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data) return null;

  const { totalVehicles, onlineVehicles, pendingFuelRequests } = data;

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: (theme) => theme.spacing(52),
        mb: 1.5,
        px: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2.5,
      }}
    >
      <Stat
        icon={<DirectionsCarIcon sx={{ fontSize: 14 }} />}
        value={totalVehicles}
        label="Total vehicles"
        color="text.secondary"
      />
      <Stat
        icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
        value={onlineVehicles}
        label="Online in last 5 min"
        color={onlineVehicles > 0 ? 'success.main' : 'text.disabled'}
      />
      {pendingFuelRequests > 0 && (
        <Stat
          icon={<LocalGasStationIcon sx={{ fontSize: 14 }} />}
          value={pendingFuelRequests}
          label="Pending fuel requests"
          color="warning.main"
        />
      )}
    </Box>
  );
};

export default FleetSummary;
