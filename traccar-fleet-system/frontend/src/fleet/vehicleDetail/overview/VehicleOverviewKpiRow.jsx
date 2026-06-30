import { Box, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { vehicleDashboardCardSx } from '../dashboardCardSx.js';
import { resolveFuelEfficiencyDisplay } from '../fuelEfficiencyDisplay.js';

function KpiCard({ title, value, subtitle, placeholder }) {
  return (
    <Box sx={vehicleDashboardCardSx}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.625rem' }}
      >
        {title}
      </Typography>
      {placeholder ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {placeholder}
        </Typography>
      ) : (
        <>
          <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

function formatCost(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return `K${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function sumCompletedCosts(records, filterFn) {
  return (records || [])
    .filter((r) => r.status === 'completed' && filterFn(r))
    .reduce((s, r) => s + (Number(r.cost) || 0), 0);
}

function formatDueLabel(item) {
  if (!item) return '—';
  if (item.isOverdue) return 'Due now';
  if (item.isTime && item.remaining != null) {
    const days = Math.round(item.remaining / 86400000);
    return `${days} days`;
  }
  if (item.type === 'totalDistance' && item.remaining != null) {
    const km = Math.round(item.remaining / 1000);
    return `${km.toLocaleString()} km`;
  }
  return item.name || '—';
}

function reliabilityStars(score) {
  const filled = Math.round(score / 20);
  return Array.from({ length: 5 }, (_, i) => (i < filled ? 'filled' : 'empty'));
}

function reliabilityLabel(score) {
  if (score >= 95) return 'Excellent';
  if (score >= 85) return 'Good';
  if (score >= 70) return 'Fair';
  return 'Needs attention';
}

export default function VehicleOverviewKpiRow({
  fuelPerformance,
  fuelPerformanceLoading,
  fuelSpecEfficiency,
  serviceRecords = [],
  maintenanceItems = [],
  overviewMetrics,
  overviewMetricsLoading,
  vehicleEngine,
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const clientMtd = sumCompletedCosts(serviceRecords, (r) => {
    const d = r.completedAt ? new Date(r.completedAt) : null;
    return d && d >= monthStart;
  });
  const clientYtd = sumCompletedCosts(serviceRecords, (r) => {
    const d = r.completedAt ? new Date(r.completedAt) : null;
    return d && d >= yearStart;
  });
  const clientLifetime = sumCompletedCosts(serviceRecords, () => true);

  const completedDates = serviceRecords
    .filter((r) => r.status === 'completed' && r.completedAt)
    .map((r) => new Date(r.completedAt).getTime());
  const earliestCompleted = completedDates.length ? new Date(Math.min(...completedDates)) : null;

  const efficiencyDisplay = resolveFuelEfficiencyDisplay(fuelPerformance, fuelSpecEfficiency);
  const fleetDelta = overviewMetrics?.fleetEfficiencyDeltaPct;
  const fleetDeltaSub = fleetDelta != null && fleetDelta > 0
    ? (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'success.main' }}>
        <TrendingUpIcon sx={{ fontSize: 14 }} />
        {`${Math.round(fleetDelta)}% better than fleet avg`}
      </Box>
    )
    : (overviewMetricsLoading ? 'Loading fleet comparison…' : null);

  const actionable = (maintenanceItems || []).filter((i) => i.isActionable);
  const nearest = actionable.sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity))[0];
  const nextService = overviewMetrics?.nextService ?? vehicleEngine?.engine?.maintenance?.nextService;
  const nextServiceValue = nextService?.remainingKm != null
    ? `${Number(nextService.remainingKm).toLocaleString()} km`
    : (nextService?.dueLabel || formatDueLabel(nearest));
  const nextServiceSub = nextService?.dueDate
    ? new Date(nextService.dueDate).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : (nextService?.name || nearest?.name || null);

  const mtd = overviewMetrics?.maintenanceCostMtd ?? clientMtd;
  const ytd = overviewMetrics?.maintenanceCostYtd ?? clientYtd;
  const lifetime = overviewMetrics?.maintenanceCostLifetime ?? clientLifetime;
  const lifetimeSince = overviewMetrics?.maintenanceLifetimeSince
    ? new Date(overviewMetrics.maintenanceLifetimeSince).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : (earliestCompleted ? earliestCompleted.toLocaleDateString(undefined, { dateStyle: 'medium' }) : null);

  const reliabilityScore = vehicleEngine?.engine?.health?.overall ?? null;
  const stars = reliabilityScore != null ? reliabilityStars(reliabilityScore) : [];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(5, 1fr)',
        },
        gap: 2,
        mb: 2,
      }}
    >
      <KpiCard
        title="Fuel Efficiency (Avg)"
        value={fuelPerformanceLoading ? '…' : efficiencyDisplay.label}
        subtitle={fleetDeltaSub || efficiencyDisplay.sub}
      />
      <KpiCard
        title="Maintenance Cost (This Month)"
        value={formatCost(mtd)}
        subtitle={ytd > 0 ? `This Year: ${formatCost(ytd)}` : 'From service records'}
      />
      <KpiCard
        title="Lifetime Maintenance Cost"
        value={formatCost(lifetime)}
        subtitle={lifetimeSince ? `Since ${lifetimeSince}` : 'From service records'}
      />
      <KpiCard
        title="Vehicle Health"
        value={reliabilityScore != null ? `${reliabilityScore}%` : '—'}
        subtitle={reliabilityScore != null ? (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap' }}>
            {stars.map((s, i) => (
              s === 'filled'
                ? <StarIcon key={i} sx={{ fontSize: 14, color: 'warning.main' }} />
                : <StarBorderIcon key={i} sx={{ fontSize: 14, color: 'text.disabled' }} />
            ))}
            <Box component="span" sx={{ ml: 0.5 }}>
              {vehicleEngine?.engine?.health?.label || reliabilityLabel(reliabilityScore)}
            </Box>
          </Box>
        ) : 'Loading health score…'}
      />
      <KpiCard
        title="Next Service Due In"
        value={nextServiceValue}
        subtitle={nextServiceSub}
      />
    </Box>
  );
}
