import { Box, Chip, Divider, Typography } from '@mui/material';
import { vehicleDashboardCardSx } from '../dashboardCardSx.js';

function formatCost(cost) {
  if (cost == null || !Number.isFinite(Number(cost))) return null;
  return `K${Number(cost).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const ACTIVE_WO_STATUSES = new Set(['open', 'scheduled', 'in_progress', 'awaiting_parts']);

function isActiveWorkOrder(record) {
  return ACTIVE_WO_STATUSES.has(record.status);
}

export default function VehicleMaintenanceOverviewPanel({
  maintenanceItems = [],
  serviceRecords = [],
  openWorkOrders = [],
  recentRepairs = [],
  loading,
}) {
  const openRecords = openWorkOrders.length > 0
    ? openWorkOrders
    : serviceRecords.filter((r) => isActiveWorkOrder(r.status));
  const pendingMaintenance = maintenanceItems.filter((i) => i.isActionable);
  const openCount = openRecords.length + pendingMaintenance.length;

  const completed = recentRepairs.length > 0
    ? recentRepairs.slice(0, 5)
    : serviceRecords.filter((r) => r.status === 'completed').slice(0, 5);

  return (
    <Box sx={vehicleDashboardCardSx}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Maintenance Overview
      </Typography>

      {loading && (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      )}

      {!loading && openCount === 0 && completed.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No open maintenance items or service records.
        </Typography>
      )}

      {openCount > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
            Open / Pending ({openCount})
          </Typography>
          {pendingMaintenance.map((item) => (
            <Box key={`m-${item.id}`} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                {item.isOverdue && (
                  <Chip size="small" color="error" label="High" sx={{ height: 20 }} />
                )}
                {!item.isOverdue && item.dueSoon && (
                  <Chip size="small" color="warning" label="Medium" sx={{ height: 20 }} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {item.isOverdue ? 'Due now' : 'Scheduled maintenance'}
              </Typography>
            </Box>
          ))}
          {openRecords.map((rec) => (
            <Box key={`r-${rec.id}`} sx={{ mb: 1.5 }}>
              <Typography variant="body2" fontWeight={600}>{rec.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {rec.status === 'in_progress' ? 'In progress'
                  : rec.status === 'awaiting_parts' ? 'Awaiting parts'
                    : rec.status === 'scheduled' ? 'Scheduled' : 'Open'}
                {rec.cost != null ? ` · ${formatCost(rec.cost)}` : ''}
                {rec.estimatedCost != null && rec.cost == null ? ` · est. ${formatCost(rec.estimatedCost)}` : ''}
              </Typography>
            </Box>
          ))}
        </>
      )}

      {completed.length > 0 && (
        <>
          {openCount > 0 && <Divider sx={{ my: 1.5 }} />}
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
            Completed ({completed.length})
          </Typography>
          {completed.map((rec) => (
            <Box key={rec.id} sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>{rec.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {rec.completedAt
                  ? new Date(rec.completedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
                  : '—'}
                {(rec.cost ?? rec.actualCost) != null ? ` · ${formatCost(rec.cost ?? rec.actualCost)}` : ''}
              </Typography>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}
