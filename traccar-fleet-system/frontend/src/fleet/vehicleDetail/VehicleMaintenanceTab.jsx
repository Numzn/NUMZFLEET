import {
  Alert, Box, Chip, Divider, Paper, Typography,
} from '@mui/material';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { vehicleDashboardCardSx } from './dashboardCardSx.js';
import VehicleMaintenanceCard from './VehicleMaintenanceCard.jsx';

const MAINTENANCE_TIMELINE_TYPES = new Set(['service.completed', 'work_order.created']);

const URGENCY_CHIP = {
  overdue: { label: 'Overdue', color: 'error' },
  due_today: { label: 'Due today', color: 'warning' },
  due_soon: { label: 'Due soon', color: 'info' },
  scheduled: { label: 'Scheduled', color: 'default' },
};

function LayerCaption({ layer }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.625rem' }}>
      Vehicle Engine · {layer}
    </Typography>
  );
}

function EngineKpi({ label, value, accent }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} color={accent || 'text.primary'} lineHeight={1.2}>
        {value}
      </Typography>
    </Box>
  );
}

function formatCost(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return `K${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatTimelineWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function VehicleMaintenanceTab({
  vehicleEngine,
  maintenance,
  fleetVehicleId,
  deviceId,
  canManage,
  onCompleted,
}) {
  const loading = vehicleEngine?.loading;
  const capabilities = vehicleEngine?.capabilities;
  const engineMaint = vehicleEngine?.engine?.maintenance;
  const hubMaint = vehicleEngine?.hub?.maintenance;
  const intelligence = vehicleEngine?.intelligence;
  const costs = vehicleEngine?.engine?.costs ?? hubMaint?.costs;
  const timeline = (vehicleEngine?.timeline ?? []).filter((e) => MAINTENANCE_TIMELINE_TYPES.has(e.type));
  const currentOdometerMeters = vehicleEngine?.hub?.telemetry?.position?.telemetry?.totalDistance
    ?? vehicleEngine?.hub?.telemetry?.telemetry?.totalDistance
    ?? null;

  const maintenanceSupported = capabilities?.maintenance !== false;
  const nextService = engineMaint?.nextService;
  const urgencyStyle = URGENCY_CHIP[nextService?.urgency] || URGENCY_CHIP.scheduled;

  const maintFindings = (intelligence?.findings ?? []).filter((f) => f.domain === 'maintenance' || f.domain === 'health');
  const maintRecommendations = intelligence?.recommendations ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!maintenanceSupported && (
        <Alert severity="info">
          Assign a tracker to this vehicle to enable maintenance schedules and odometer-based service reminders.
        </Alert>
      )}

      {/* Engine — what the facts mean */}
      <Box sx={vehicleDashboardCardSx}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 2 }}>
          <Box>
            <LayerCaption layer="Engine" />
            <Typography variant="subtitle1" fontWeight={700}>
              Maintenance status
            </Typography>
          </Box>
          <BuildOutlinedIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
        </Box>

        {loading && (
          <Typography variant="body2" color="text.secondary">Loading engine…</Typography>
        )}

        {!loading && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            <EngineKpi
              label="Maintenance health"
              value={engineMaint?.healthScore != null ? `${engineMaint.healthScore}%` : '—'}
              accent={engineMaint?.healthScore != null && engineMaint.healthScore < 70 ? 'warning.main' : undefined}
            />
            <EngineKpi
              label="Overdue"
              value={String(engineMaint?.overdueCount ?? 0)}
              accent={(engineMaint?.overdueCount ?? 0) > 0 ? 'error.main' : undefined}
            />
            <EngineKpi
              label="Due soon"
              value={String(engineMaint?.dueSoonCount ?? 0)}
              accent={(engineMaint?.dueSoonCount ?? 0) > 0 ? 'warning.main' : undefined}
            />
            <EngineKpi
              label="Open work orders"
              value={String(engineMaint?.openWorkOrders ?? 0)}
            />
          </Box>
        )}

        {!loading && nextService?.name && (
          <Paper variant="outlined" sx={{ mt: 2, p: 1.5, bgcolor: 'var(--surface-workspace)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Next service
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {nextService.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {nextService.dueLabel || '—'}
                  {nextService.remainingKm != null ? ` · ${Number(nextService.remainingKm).toLocaleString()} km` : ''}
                </Typography>
              </Box>
              <Chip size="small" label={urgencyStyle.label} color={urgencyStyle.color} />
            </Box>
          </Paper>
        )}

        {!loading && !nextService?.name && maintenanceSupported && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            No upcoming service yet — use <strong>Add schedule</strong> below (or open a work order).
          </Typography>
        )}
      </Box>

      {/* Intelligence — what to do */}
      {!loading && (maintRecommendations.length > 0 || maintFindings.length > 0) && (
        <Box sx={vehicleDashboardCardSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LightbulbOutlinedIcon sx={{ fontSize: 20, color: 'warning.main' }} />
            <Box>
              <LayerCaption layer="Intelligence" />
              <Typography variant="subtitle1" fontWeight={700}>
                Recommendations
              </Typography>
            </Box>
          </Box>
          {maintRecommendations.map((rec, i) => (
            <Box key={`rec-${i}`} sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={600}>{rec.text}</Typography>
            </Box>
          ))}
          {maintFindings.map((f, i) => (
            <Typography key={`f-${i}`} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {f.text}
            </Typography>
          ))}
        </Box>
      )}

      {/* Hub — schedules + work orders */}
      <Box sx={vehicleDashboardCardSx}>
        <Box sx={{ mb: 1.5 }}>
          <LayerCaption layer="Hub" />
          <Typography variant="subtitle1" fontWeight={700}>
            Schedules & work orders
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Facts from Traccar schedules and service records — not recalculated in the UI.
          </Typography>
        </Box>

        {deviceId && maintenanceSupported ? (
          <VehicleMaintenanceCard
            items={maintenance.items}
            loading={maintenance.loading}
            deviceId={deviceId}
            fleetVehicleId={fleetVehicleId}
            currentOdometerMeters={currentOdometerMeters}
            openWorkOrders={maintenance.openWorkOrders}
            canManage={canManage}
            onCompleted={onCompleted}
            embedded
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No tracker assigned — schedules cannot be loaded.
          </Typography>
        )}
      </Box>

      {/* Hub — costs */}
      {!loading && costs && (
        <Box sx={vehicleDashboardCardSx}>
          <LayerCaption layer="Hub" />
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Maintenance costs
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            <EngineKpi label="This month" value={formatCost(costs.maintenanceMtd ?? costs.mtd)} />
            <EngineKpi label="This year" value={formatCost(costs.maintenanceYtd ?? costs.ytd)} />
            <EngineKpi label="Lifetime" value={formatCost(costs.maintenanceLifetime ?? costs.lifetime)} />
          </Box>
        </Box>
      )}

      {/* Timeline — what happened */}
      <Box sx={vehicleDashboardCardSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <HistoryOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Box>
            <LayerCaption layer="Timeline" />
            <Typography variant="subtitle1" fontWeight={700}>
              Recent maintenance activity
            </Typography>
          </Box>
        </Box>

        {loading && (
          <Typography variant="body2" color="text.secondary">Loading timeline…</Typography>
        )}

        {!loading && timeline.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No completed services or work orders yet.
          </Typography>
        )}

        {!loading && timeline.map((entry, idx) => (
          <Box key={entry.id}>
            {idx > 0 ? <Divider sx={{ my: 1.25 }} /> : null}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              {entry.type === 'service.completed' ? (
                <ScheduleOutlinedIcon sx={{ fontSize: 18, color: 'success.main', mt: 0.25 }} />
              ) : (
                <WarningAmberOutlinedIcon sx={{ fontSize: 18, color: 'info.main', mt: 0.25 }} />
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {entry.summary}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTimelineWhen(entry.occurredAt)}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
