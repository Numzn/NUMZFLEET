import { Box, Chip, Typography } from '@mui/material';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';

import { vehicleDashboardCardSx } from './dashboardCardSx.js';

const ignitionLabel = (raw) => {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return 'Running';
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return 'Off';
  return null;
};

export default function EngineStatusCard({ telemetry }) {
  const ign = ignitionLabel(telemetry?.ignition);
  const normal =
    telemetry?.coolantC != null &&
    telemetry.coolantC < 110 &&
    (ign == null || ign === 'Running');

  return (
    <Box sx={vehicleDashboardCardSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrecisionManufacturingIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            Engine status
          </Typography>
        </Box>
        <Chip
          size="small"
          label={normal ? 'Nominal' : ign || 'Unknown'}
          color={normal ? 'success' : 'default'}
          variant="outlined"
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        Coolant:{' '}
        {telemetry?.coolantC != null ? `${Math.round(telemetry.coolantC)} °C` : '—'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Load: {telemetry?.engineLoadPct != null ? `${Math.round(telemetry.engineLoadPct)}%` : '—'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        RPM: {telemetry?.rpm != null ? Math.round(telemetry.rpm).toLocaleString() : '—'}
      </Typography>
    </Box>
  );
}
