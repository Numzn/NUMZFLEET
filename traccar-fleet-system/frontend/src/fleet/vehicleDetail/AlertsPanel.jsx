import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { vehicleDashboardCardSx } from './dashboardCardSx.js';

const formatTime = (t) => {
  if (!t) return '—';
  try {
    return new Date(t).toLocaleString();
  } catch {
    return t;
  }
};

export default function AlertsPanel({ alerts }) {
  return (
    <Box sx={[vehicleDashboardCardSx, { height: 'auto' }]}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WarningAmberIcon color="warning" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={600}>
          Recent alerts
        </Typography>
      </Box>
      {!alerts?.length ? (
        <Typography variant="body2" color="text.secondary">
          No recent alerts for this device in the live buffer (speeding, geofence, alarms appear here as
          the server delivers them).
        </Typography>
      ) : (
        <List dense disablePadding>
          {alerts.map((a) => (
            <ListItem key={a.id} disableGutters sx={{ alignItems: 'flex-start' }}>
              <ListItemText
                primary={a.message || a.type}
                secondary={`${a.type} · ${formatTime(a.time)}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
