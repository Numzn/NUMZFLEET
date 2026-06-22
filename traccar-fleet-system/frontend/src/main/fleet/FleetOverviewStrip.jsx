import { Box, Typography } from '@mui/material';
import { formatStatusLabel } from '../../operationSessions/utils/operationDayUtils.js';

function OverviewRow({ label, value, onClick }) {
  const clickable = typeof onClick === 'function';
  return (
    <Box
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        py: 0.35,
        cursor: clickable ? 'pointer' : 'default',
        borderRadius: clickable ? 1 : 0,
        '&:hover': clickable ? { bgcolor: 'action.hover' } : undefined,
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function fuelOverviewLine(todayOperation, todayDetails, loading) {
  if (loading) return 'Loading…';
  if (!todayOperation?.id) return 'No operation today';
  const status = todayDetails?.effectiveStatus
    || todayOperation?.effectiveStatus
    || todayOperation?.status;
  const label = formatStatusLabel(status);
  if (String(status || '').toLowerCase() === 'approved') {
    return `Fuel active · ${label}`;
  }
  return label;
}

/**
 * Level 1 fleet overview peek — counts only, no vehicle list.
 */
const FleetOverviewStrip = ({
  deviceStats = {},
  alertCount = 0,
  todayOperation,
  todayDetails,
  todayLoading = false,
  onFuelTap,
}) => {
  const total = deviceStats.total ?? 0;
  const moving = deviceStats.moving ?? 0;

  return (
    <Box sx={{ px: 1.5, pb: 1, pt: 0.25 }}>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 800,
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          mb: 0.75,
        }}
      >
        Fleet overview
      </Typography>
      <OverviewRow
        label="Vehicles"
        value={total}
      />
      <OverviewRow
        label="Moving"
        value={moving}
      />
      <OverviewRow
        label="Alerts"
        value={alertCount}
      />
      <OverviewRow
        label="Fuel"
        value={fuelOverviewLine(todayOperation, todayDetails, todayLoading)}
        onClick={onFuelTap}
      />
    </Box>
  );
};

export default FleetOverviewStrip;
