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

export default function VehicleAlertsColumn({ alerts, deviceId }) {
  const navigate = useNavigate();
  const { showToast } = useToastNotifications();
  const enriched = useMemo(() => enrichAlerts(alerts), [alerts]);
  const hasAlerts = enriched.length > 0;
  const [expanded, setExpanded] = useState(hasAlerts);

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
                ({enriched.length})
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
                All systems operating normally
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {enriched.map((a) => (
                <Box
                  key={a.id}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderLeftWidth: 3,
                    borderLeftColor: SEVERITY_BORDER[a.severity] || SEVERITY_BORDER.warning,
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                    {severityIcon(a.severity)}
                    {' '}
                    {a.message || a.type}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {a.type}
                    {' · '}
                    {formatTime(a.time)}
                  </Typography>
                  {a.severity === 'critical' && (
                    <Button
                      size="small"
                      sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem' }}
                      onClick={() => showToast('Escalation workflow coming soon', 'info')}
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
                  onClick={() => {
                    if (deviceId != null) {
                      navigate(`/reports/events?deviceId=${deviceId}`);
                    } else {
                      navigate('/reports/events');
                    }
                  }}
                >
                  View all alerts →
                </Button>
              </Box>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
