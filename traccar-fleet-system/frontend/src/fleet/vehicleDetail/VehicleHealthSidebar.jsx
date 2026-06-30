import { Box, CircularProgress, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import { WORKSPACE_COLORS } from './vehicleWorkspaceTokens.js';
import { buildVehicleHealthMetrics, healthLabel, pickHealthDisplayRows } from './vehicleHealthMetrics.js';

const RING_SIZE = 72;

function ringColor(score) {
  if (score == null) return 'text.disabled';
  if (score >= 90) return WORKSPACE_COLORS.success;
  if (score >= 75) return WORKSPACE_COLORS.primary;
  return WORKSPACE_COLORS.warning;
}

function StatusIcon({ severity }) {
  const sx = { fontSize: 14, flexShrink: 0 };
  if (severity === 'error') {
    return <ErrorOutlineIcon sx={{ ...sx, color: WORKSPACE_COLORS.warning }} />;
  }
  if (severity === 'warning') {
    return <WarningAmberOutlinedIcon sx={{ ...sx, color: WORKSPACE_COLORS.warning }} />;
  }
  if (severity === 'success') {
    return <CheckCircleOutlineIcon sx={{ ...sx, color: WORKSPACE_COLORS.success }} />;
  }
  return <CheckCircleOutlineIcon sx={{ ...sx, color: 'text.disabled' }} />;
}

function MetricRow({ label, value }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 1,
        minWidth: 0,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="caption"
        fontWeight={700}
        sx={{ lineHeight: 1.3, textAlign: 'right', minWidth: 0 }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function rowsFromEngine(health, online) {
  const rows = [];
  if (health?.domains?.maintenance != null) {
    rows.push({
      id: 'maintenance',
      label: 'Maintenance',
      value: health.domains.maintenance >= 85 ? 'Up to date' : 'Attention needed',
      severity: health.domains.maintenance >= 85 ? 'success' : 'warning',
    });
  }
  if (health?.domains?.fuel != null) {
    rows.push({
      id: 'fuel',
      label: 'Fuel',
      value: `${health.domains.fuel}%`,
      severity: health.domains.fuel >= 65 ? 'success' : 'warning',
    });
  }
  rows.push({
    id: 'tracker',
    label: 'Tracker',
    value: online ? 'Online' : 'Offline',
    severity: online ? 'success' : 'default',
  });
  return rows;
}

export default function VehicleHealthSidebar({
  telemetry,
  maintenanceItems = [],
  fuelPerformance,
  online,
  vehicleEngine,
}) {
  const engineHealth = vehicleEngine?.engine?.health;
  const engineOnline = vehicleEngine?.hub?.telemetry?.online ?? online;

  let composite;
  let rows;
  let subtitle;
  let scoredCount;

  if (engineHealth?.overall != null) {
    composite = engineHealth.overall;
    rows = rowsFromEngine(engineHealth, engineOnline);
    subtitle = 'Vehicle Engine';
    scoredCount = rows.length;
  } else {
    const built = buildVehicleHealthMetrics({
      telemetry,
      maintenanceItems,
      fuelPerformance,
      online: engineOnline,
    });
    composite = built.composite;
    rows = built.rows;
    subtitle = built.subtitle;
    scoredCount = built.scoredCount;
  }

  const displayRows = pickHealthDisplayRows(rows, 4);
  const label = engineHealth?.label ?? healthLabel(composite);

  return (
    <Box
      sx={[
        vehicleWorkspaceCardSx,
        {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 'var(--space-3)', lg: 'var(--space-3)' },
          minHeight: 0,
        },
      ]}
    >
      <Box sx={{ mb: 1, flexShrink: 0 }}>
        <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2}>
          Vehicle Health
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.3}>
          {subtitle}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >
          <CircularProgress
            variant="determinate"
            value={100}
            size={RING_SIZE}
            thickness={4}
            sx={{ color: 'var(--surface-workspace)' }}
          />
          <CircularProgress
            variant="determinate"
            value={composite ?? 0}
            size={RING_SIZE}
            thickness={4}
            sx={{
              color: ringColor(composite),
              position: 'absolute',
              left: 0,
              strokeLinecap: 'round',
              opacity: composite != null ? 1 : 0.35,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            <Typography variant="body1" fontWeight={800} lineHeight={1} sx={{ fontSize: '1.1rem' }}>
              {composite != null ? `${composite}%` : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.625rem' }}>
              {composite != null ? label : (scoredCount === 0 ? 'No data' : 'Partial')}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.6,
            justifyContent: 'center',
          }}
        >
          {displayRows.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Connect a tracker to see live health signals.
            </Typography>
          ) : (
            displayRows.map((row) => (
              <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <StatusIcon severity={row.severity} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MetricRow label={row.label} value={row.value} />
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}
