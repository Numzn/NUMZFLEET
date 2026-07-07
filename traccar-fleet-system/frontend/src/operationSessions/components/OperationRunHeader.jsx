import { Box, Card, CardContent, Divider, Typography } from '@mui/material';
import { formatK, formatLitres } from '../utils/formatters.js';
import { deriveFuelingDayStatus, sumPlannedLitres } from '../utils/operationDayUtils.js';

const SummaryStat = ({ value, label, warn = false }) => (
  <Box sx={{ flex: 1, textAlign: 'center' }}>
    <Typography
      sx={{
        fontSize: '1.2rem',
        fontWeight: 800,
        color: warn ? 'warning.main' : 'primary.main',
        lineHeight: 1.2,
      }}
    >
      {value}
    </Typography>
    <Typography variant="caption" sx={{ letterSpacing: 0.4, color: 'text.secondary', textTransform: 'uppercase' }}>
      {label}
    </Typography>
  </Box>
);

export default function OperationRunHeader({ session, buckets }) {
  const effectiveStatus = session?.effectiveStatus || session?.status;
  const isDraft = String(effectiveStatus).toLowerCase() === 'draft';
  const displayStatus = deriveFuelingDayStatus({ operation: session, details: session });
  const plannedL = sumPlannedLitres(session?.refuels || []);
  const counts = buckets || {
    selected: 0, arrived: 0, fueled: 0, skipped: 0, missing: 0,
  };
  // Only show a spend figure once something real has been dispensed — never a fake K0.
  const hasSpend = counts.fueled > 0 && session?.totalActualCost != null;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 1.5 }}>
      <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 800 }}>
            Fueling
          </Typography>
          <Typography variant="overline" sx={{ letterSpacing: 0.6, fontWeight: 700, color: 'text.secondary' }}>
            {counts.selected}
            {' '}
            {counts.selected === 1 ? 'VEHICLE' : 'VEHICLES'}
          </Typography>
        </Box>

        <Divider sx={{ my: 0.75 }} />

        {isDraft ? (
          <Box sx={{ display: 'flex' }}>
            <SummaryStat value={counts.selected} label="Planned" />
            <SummaryStat value={formatLitres(plannedL)} label="Planned L" />
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex' }}>
              <SummaryStat value={counts.fueled} label="Fueled" />
              <SummaryStat value={counts.missing} label="Remaining" warn={counts.missing > 0} />
              <SummaryStat value={formatLitres(session?.totalActualFuel)} label="Dispensed" />
            </Box>
            {(hasSpend || displayStatus !== 'planning') && (
              <>
                <Divider sx={{ my: 0.75 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Spent</Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {hasSpend ? formatK(session.totalActualCost) : '—'}
                  </Typography>
                </Box>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
