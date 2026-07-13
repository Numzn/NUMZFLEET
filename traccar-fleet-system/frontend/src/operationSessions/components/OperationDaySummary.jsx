import { Box, Chip, Stack, Typography } from '@mui/material';
import { formatLitres, formatZmw } from '../utils/formatters.js';
import {
  sumPlannedLitres,
  summarizeRefuelBuckets,
  deriveFuelingDayStatus,
  FUELING_DAY_STATUS_LABEL,
  fuelingDayStatusColor,
} from '../utils/operationDayUtils.js';

function sumActualLitres(refuels = []) {
  return refuels.reduce((acc, r) => {
    const a = r.actualFuelLitres != null ? Number(r.actualFuelLitres) : 0;
    return acc + (Number.isFinite(a) && a > 0 ? a : 0);
  }, 0);
}

function sumActualCost(refuels = []) {
  return refuels.reduce((acc, r) => {
    const c = r.actualCost ?? r.fuelCost;
    const n = c != null ? Number(c) : 0;
    return acc + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

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

// 'pending' means "not yet reconciled" (no OCR/reconciliation is wired up
// today) — this chip only renders when invoiceSummary.count > 0, so at this
// call site 'pending' always means a document is attached, just not reconciled.
const INVOICE_LABEL = {
  matched: 'Invoices matched',
  variance: 'Invoice variance',
  pending: 'Attached',
};

/**
 * @param {'compact' | 'full'} variant — compact for the layout bar; full for accordions
 * @param {'prepare' | 'inProgress' | 'closeout'} phase — which metrics to show
 */
export default function OperationDaySummary({
  operation, details, variant = 'compact', phase = 'inProgress',
}) {
  const refuels = details?.refuels || [];
  const status = details?.effectiveStatus || operation?.effectiveStatus || operation?.status;
  const plannedTotalL = sumPlannedLitres(refuels);
  const sessionActualL = Number(details?.totalActualFuel ?? operation?.totalActualFuel ?? 0);
  const refuelActualL = sumActualLitres(refuels);
  const actualTotalL = sessionActualL > 0 ? sessionActualL : refuelActualL;
  const sessionActualCost = Number(details?.totalActualCost ?? operation?.totalActualCost ?? 0);
  const refuelActualCost = sumActualCost(refuels);
  const actualCost = sessionActualCost > 0 ? sessionActualCost : refuelActualCost;
  const varianceL = actualTotalL - plannedTotalL;
  const buckets = summarizeRefuelBuckets(refuels);
  const invoiceSummary = details?.invoiceSummary;
  const statusLower = String(status).toLowerCase();
  const isDraft = statusLower === 'draft';
  const displayStatus = deriveFuelingDayStatus({ operation, details });
  const effectivePhase = phase === 'inProgress' && isDraft ? 'prepare' : phase;
  const showFuelTotals = !isDraft && (actualTotalL > 0 || statusLower === 'approved');

  const prepareStats = (
    <>
      <Stat label="Planned" value={buckets.selected} />
      <Stat label="Planned L" value={formatLitres(plannedTotalL)} />
    </>
  );

  const inProgressStats = (
    <>
      <Stat label="Planned" value={buckets.selected} />
      <Stat label="Arrived" value={buckets.arrived} />
      <Stat label="Fueled" value={buckets.fueled} />
      <Stat label="Remaining" value={buckets.missing} warn={buckets.missing > 0} />
      {buckets.skipped > 0 && <Stat label="Skipped" value={buckets.skipped} />}
      <Stat label="Planned L" value={formatLitres(plannedTotalL)} />
      {showFuelTotals && (
        <>
          <Stat label="Actual" value={formatLitres(actualTotalL)} />
          <Stat label="Cost" value={formatZmw(actualCost)} />
        </>
      )}
    </>
  );

  const closeoutStats = (
    <>
      <Stat label="Fueled" value={buckets.fueled} />
      <Stat label="Remaining" value={buckets.missing} warn={buckets.missing > 0} />
      {buckets.skipped > 0 && <Stat label="Skipped" value={buckets.skipped} />}
      <Stat label="Planned L" value={formatLitres(plannedTotalL)} />
      <Stat label="Actual" value={formatLitres(actualTotalL)} />
      <Stat label="Cost" value={formatZmw(actualCost)} />
    </>
  );

  const statsForPhase = effectivePhase === 'prepare'
    ? prepareStats
    : effectivePhase === 'closeout'
      ? closeoutStats
      : inProgressStats;

  if (variant === 'full') {
    return (
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={800}>
            {operation?.reference || details?.reference || operation?.name || 'Fueling Day'}
          </Typography>
          <Chip
            size="small"
            label={FUELING_DAY_STATUS_LABEL[displayStatus]}
            color={fuelingDayStatusColor(displayStatus)}
          />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
          {effectivePhase === 'prepare' ? prepareStats : (
            <>
              <Stat label="Planned" value={buckets.selected} />
              {!isDraft && (
                <>
                  <Stat label="Arrived" value={buckets.arrived} />
                  <Stat label="Fueled" value={buckets.fueled} />
                  <Stat label="Remaining" value={buckets.missing} warn={buckets.missing > 0} />
                  {buckets.skipped > 0 && <Stat label="Skipped" value={buckets.skipped} />}
                </>
              )}
              <Stat label="Planned L" value={formatLitres(plannedTotalL)} />
              {showFuelTotals && (
                <>
                  <Stat label="Actual" value={formatLitres(actualTotalL)} />
                  <Stat
                    label="Variance"
                    value={`${varianceL >= 0 ? '+' : ''}${varianceL.toFixed(1)} L`}
                    warn={Math.abs(varianceL) > 0.5}
                  />
                  <Stat label="Cost" value={formatZmw(actualCost)} />
                </>
              )}
            </>
          )}
        </Box>
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
        {statsForPhase}
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
        {invoiceSummary?.count > 0 && (
          <Chip
            size="small"
            variant="outlined"
            label={`${INVOICE_LABEL[invoiceSummary.status] || INVOICE_LABEL.pending}${invoiceSummary.count > 1 ? ` (${invoiceSummary.count})` : ''}`}
            color={invoiceSummary.status === 'matched' ? 'success' : invoiceSummary.status === 'variance' ? 'error' : 'default'}
          />
        )}
        <Chip
          size="small"
          label={FUELING_DAY_STATUS_LABEL[displayStatus]}
          color={fuelingDayStatusColor(displayStatus)}
        />
      </Stack>
    </Box>
  );
}
