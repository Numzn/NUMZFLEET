import {
  Box, Grid, LinearProgress, Paper, Typography,
} from '@mui/material';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts';

const BREAKDOWN_COLORS = {
  labour: '#3b82f6',
  parts: '#10b981',
  other: '#f59e0b',
};

const CARD_SX = {
  p: 2,
  height: '100%',
  minHeight: 260,
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
};

const PROGRESS_SX = {
  height: 8,
  borderRadius: 1,
  backgroundColor: 'action.hover',
  '& .MuiLinearProgress-bar': {
    borderRadius: 1,
    backgroundColor: 'primary.main',
  },
};

function formatMoney(amount, currency = 'ZMW') {
  if (amount == null) return '—';
  return `${currency} ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function MaintenanceCostPanel({ costs }) {
  if (!costs) return null;

  const {
    currency, monthTotal, monthTrendPct, breakdown, breakdownAmounts, topVehicles, dailySeries, budget,
  } = costs;
  const trendLabel = monthTrendPct > 0 ? `+${monthTrendPct}%` : `${monthTrendPct}%`;
  const trendColor = monthTrendPct > 0 ? 'error.main' : 'success.main';

  const breakdownData = [
    { name: 'Labour', pct: breakdown?.labour ?? 0, amount: breakdownAmounts?.labour ?? 0, key: 'labour' },
    { name: 'Parts', pct: breakdown?.parts ?? 0, amount: breakdownAmounts?.parts ?? 0, key: 'parts' },
    { name: 'Other', pct: breakdown?.other ?? 0, amount: breakdownAmounts?.other ?? 0, key: 'other' },
  ];

  const topData = (topVehicles || []).map((v) => ({
    name: v.label || v.plate || v.name,
    total: v.total,
  }));

  return (
    <Grid
      container
      spacing={1.5}
      sx={{
        alignItems: 'stretch',
        width: '100%',
        m: 0,
      }}
    >
      <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', minWidth: 0 }}>
        <Paper variant="outlined" sx={CARD_SX}>
          <Typography variant="overline" color="text.secondary" display="block">
            This month
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
            {formatMoney(monthTotal, currency)}
          </Typography>
          <Typography variant="body2" sx={{ color: trendColor, fontWeight: 600, mt: 0.5 }}>
            {trendLabel} vs last month
          </Typography>
          <Box sx={{ flex: 1, minHeight: 120, mt: 2 }}>
            {dailySeries?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip formatter={(v) => formatMoney(v, currency)} />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box
                sx={{
                  height: '100%',
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  No spend recorded this period
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', minWidth: 0 }}>
        <Paper variant="outlined" sx={CARD_SX}>
          <Typography variant="overline" color="text.secondary" display="block">
            Cost breakdown
          </Typography>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, mt: 1 }}>
            {breakdownData.map((row) => (
              <Box key={row.key}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75, gap: 1 }}>
                  <Typography variant="body2">{row.name}</Typography>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {row.pct}% · {formatMoney(row.amount, currency)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={row.pct}
                  sx={{
                    ...PROGRESS_SX,
                    '& .MuiLinearProgress-bar': {
                      ...PROGRESS_SX['& .MuiLinearProgress-bar'],
                      backgroundColor: BREAKDOWN_COLORS[row.key],
                    },
                  }}
                />
              </Box>
            ))}
          </Box>
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', minWidth: 0 }}>
        <Paper variant="outlined" sx={CARD_SX}>
          <Typography variant="overline" color="text.secondary" display="block">
            Budget remaining
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
            {budget?.usedPct != null ? `${100 - budget.usedPct}%` : '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {formatMoney(budget?.remaining, currency)} of {formatMoney(budget?.monthlyBudget, currency)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, budget?.usedPct ?? 0)}
            sx={{ ...PROGRESS_SX, mt: 2, height: 10 }}
          />
          <Box sx={{ flex: 1, minHeight: 120, mt: 2 }}>
            {topData.length > 0 ? (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Top vehicles
                </Typography>
                <ResponsiveContainer width="100%" height="calc(100% - 1.25rem)">
                  <BarChart data={topData} layout="vertical" margin={{ left: 4, right: 8, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatMoney(v, currency)} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {topData.map((_, i) => (
                        <Cell key={i} fill="#6366f1" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <Box
                sx={{
                  height: '100%',
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  No vehicle spend yet
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}
