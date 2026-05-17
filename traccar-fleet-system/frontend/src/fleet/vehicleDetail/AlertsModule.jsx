import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { vehicleAlertSx } from './dashboardCardSx.js';

const formatTime = (t) => {
  if (!t) return '—';
  try {
    return new Date(t).toLocaleString();
  } catch {
    return t;
  }
};

export default function AlertsModule({ alerts }) {
  const hasAlerts = Boolean(alerts?.length);
  return (
    <Box sx={[vehicleAlertSx(hasAlerts), { height: 'auto' }]}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WarningAmberIcon color="warning" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={700}>
          Alerts
        </Typography>
      </Box>
      {!hasAlerts ? (
        <Typography variant="body2" color="text.secondary">
          No recent alerts for this device in the live buffer (speeding, geofence, alarms appear here as the server
          delivers them).
        </Typography>
      ) : (
        <List dense disablePadding>
          {alerts.map((a) => (
            <ListItem key={a.id} disableGutters sx={{ alignItems: 'flex-start' }}>
              <ListItemText primary={a.message || a.type} secondary={`${a.type} · ${formatTime(a.time)}`} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
