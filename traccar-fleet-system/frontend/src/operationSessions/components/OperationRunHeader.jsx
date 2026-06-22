import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { formatLitres, formatZmw } from '../utils/formatters.js';
import {
  sumPlannedLitres,
  deriveFuelingDayStatus,
  FUELING_DAY_STATUS_LABEL,
  fuelingDayStatusColor,
} from '../utils/operationDayUtils.js';

function Stat({ label, value, warn = false }) {
  return (
    <Box sx={{ minWidth: 56 }}>
      <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={700}
        color={warn ? 'warning.main' : 'text.primary'}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function OperationRunHeader({ session, sessionId, buckets }) {
  const effectiveStatus = session?.effectiveStatus || session?.status;
  const isDraft = String(effectiveStatus).toLowerCase() === 'draft';
  const displayStatus = deriveFuelingDayStatus({ operation: session, details: session });
  const plannedL = sumPlannedLitres(session?.refuels || []);
  const counts = buckets || {
    selected: 0, arrived: 0, fueled: 0, skipped: 0, missing: 0,
  };

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2 }}>
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              {session?.reference || session?.name || `Fueling Day ${sessionId}`}
            </Typography>
            {session?.stationName && (
              <Typography variant="body2" color="text.secondary">
                {session.stationName}
              </Typography>
            )}
          </Box>
          <Chip
            size="small"
            label={FUELING_DAY_STATUS_LABEL[displayStatus]}
            color={fuelingDayStatusColor(displayStatus)}
          />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
          {isDraft ? (
            <>
              <Stat label="Planned" value={counts.selected} />
              <Stat label="Planned L" value={formatLitres(plannedL)} />
            </>
          ) : (
            <>
              <Stat label="Planned" value={counts.selected} />
              <Stat label="Arrived" value={counts.arrived} />
              <Stat label="Fueled" value={counts.fueled} />
              <Stat label="Remaining" value={counts.missing} warn={counts.missing > 0} />
              {counts.skipped > 0 && <Stat label="Skipped" value={counts.skipped} />}
              <Stat label="Dispensed" value={formatLitres(session?.totalActualFuel)} />
              <Stat label="Cost" value={formatZmw(session?.totalActualCost)} />
            </>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
