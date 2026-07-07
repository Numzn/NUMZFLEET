import { Box, Chip, Typography } from '@mui/material';
import { formatK, formatLitres } from '../utils/formatters.js';
import { varianceTone } from '../utils/operationDayUtils.js';
import OperationVehicleLabel from './OperationVehicleLabel.jsx';

export default function CompletedRefuelCard({ refuel }) {
  const planned = refuel.plannedFuelLitres != null ? Number(refuel.plannedFuelLitres) : null;
  const actual = Number(refuel.actualFuelLitres);
  const varianceL = planned != null && Number.isFinite(planned) ? actual - planned : null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ minWidth: 120 }}>
        <OperationVehicleLabel
          deviceId={refuel.vehicleId}
          titleVariant="body2"
          titleWeight={600}
          compact
        />
      </Box>
      <Typography variant="body2" color="text.secondary" component="div">
        {formatLitres(refuel.actualFuelLitres)}
        {refuel.actualCost != null && (
          <>
            {' · '}
            {formatK(refuel.actualCost)}
          </>
        )}
        {refuel.odometerKm != null && (
          <>
            {' · '}
            {Number(refuel.odometerKm).toLocaleString()}
            {' km'}
          </>
        )}
        {varianceL != null && Number.isFinite(varianceL) && (
          <>
            {' · '}
            <Chip
              size="small"
              label={`${varianceL >= 0 ? '+' : ''}${varianceL.toFixed(1)} L`}
              color={varianceTone(planned, actual)}
            />
          </>
        )}
      </Typography>
    </Box>
  );
}
