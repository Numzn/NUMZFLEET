import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate } from 'react-router-dom';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import { SEVERITY_BORDER } from './vehicleWorkspaceTokens.js';
import { enrichAlerts } from './vehicleAlertUtils.js';
import useVehicleTrackingNotifications from './useVehicleTrackingNotifications.js';
import { useEscalateVehicleAlert } from './escalateVehicleAlert.js';
import { useToastNotifications } from '../../hooks/useToastNotifications.jsx';

const formatTime = (t) => {
  if (!t) return '—';
  try {
    return new Date(t).toLocaleString();
  } catch {
    return t;
  }
};

const severityIcon = (severity) => {
  if (severity === 'critical') return '🔴';
  if (severity === 'warning') return '⚠️';
  if (severity === 'info') return 'ℹ️';
  return '✅';
};

export default function VehicleAlertsColumn({
  alerts,
  deviceId,
  geofenceAlertsHidden = false,
  geofenceAlertsSuppressed = 0,
  linkedZoneCount = null,
  linkedZonesLoading = false,
}) {
  const navigate = useNavigate();
  const { showToast } = useToastNotifications();
  const escalateAlert = useEscalateVehicleAlert();
  const legacyEnriched = useMemo(() => enrichAlerts(alerts), [alerts]);
  const displayAlerts = useVehicleTrackingNotifications(deviceId, legacyEnriched);
  const hasAlerts = displayAlerts.length > 0;
  const [expanded, setExpanded] = useState(hasAlerts);

  const handleEscalate = async (alert) => {
    try {
      await escalateAlert({
        deviceId,
        alertId: alert.id,
        title: alert.message || 'Vehicle alert escalated',
        message: alert.message || alert.type,
      });
      showToast('Alert escalated to managers', 'success');
    } catch (e) {
      showToast(e?.message || 'Escalation failed', 'error');
    }
  };

  return (
    <Box sx={[vehicleWorkspaceCardSx, { height: 'auto' }]}>
      <Accordion
        expanded={expanded}
        onChange={(_, v) => setExpanded(v)}
        disableGutters
        elevation={0}
        sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon color={hasAlerts ? 'warning' : 'disabled'} fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              Alerts
            </Typography>
            {hasAlerts && (
              <Typography variant="caption" color="text.secondary">
                ({displayAlerts.length})
              </Typography>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          {!hasAlerts ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                No active alerts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {geofenceAlertsHidden && geofenceAlertsSuppressed > 0
                  ? 'Geofence alerts are hidden by vehicle preference.'
                  : !linkedZonesLoading && linkedZoneCount === 0 && deviceId != null
                    ? 'No zones linked — enter/exit events will not generate until zones are linked to this device.'
                    : 'All systems operating normally'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {displayAlerts.map((a) => (
                <Box
                  key={a.id}
                  sx={{
                    p: 'var(--space-3)',
                    mb: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--surface-border)',
                    borderLeftWidth: 3,
                    borderLeftColor: SEVERITY_BORDER[a.severity] || SEVERITY_BORDER.warning,
                    bgcolor: 'var(--surface-card)',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                    {severityIcon(a.severity)}
                    {' '}
                    {a.message || a.type}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {a.type}
                    {a.source === 'notification' ? ' · notification' : ''}
                    {' · '}
                    {formatTime(a.time)}
                  </Typography>
                  {a.severity === 'critical' && (
                    <Button
                      size="small"
                      sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem' }}
                      onClick={() => handleEscalate(a)}
                    >
                      Escalate
                    </Button>
                  )}
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                <Button
                  size="small"
                  sx={{ textTransform: 'none' }}
                  onClick={() => navigate('/?notifications=tracking')}
                >
                  Open notification inbox →
                </Button>
              </Box>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
