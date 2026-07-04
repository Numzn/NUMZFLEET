import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { makeStyles } from 'tss-react/mui';
import FleetWorkspaceShell from '../../common/components/FleetWorkspaceShell';
import { useManager, useDeviceReadonly } from '../../common/util/permissions';
import { speedFromKnots } from '../../common/util/converter';
import {
  operationalDialogActionsSx,
  operationalDialogContentSx,
  operationalDialogPaperProps,
  operationalDialogPrimaryActionSx,
  operationalDialogTitleSx,
} from '../../common/styles/operationalDialogSx';
import useVehicleData from './useVehicleData';
import useImmobilizationIntent from './hooks/useImmobilizationIntent';
import { vehicleWorkspaceCardSx } from './dashboardCardSx.js';
import { vehicleWorkspacePath } from '../vehicleRegistry/vehicleRegistryUtils.js';
import { getIgnitionPhrase } from './vehicleMotionStatus.js';
import { formatExecutionError, formatDeliveryPhase } from './immobilizationErrors.js';
import { describeImmobilizationCapabilities } from './immobilizationDisplayUtils.js';

const useStyles = makeStyles()((theme) => ({
  container: {
    padding: theme.spacing(2),
  },
}));

function GateRow({ gate }) {
  const pass = gate?.pass;
  const Icon = pass ? CheckCircleIcon : CancelIcon;
  const color = pass ? 'success' : 'disabled';
  let secondary = null;
  if (gate?.elapsedSec != null && gate?.requiredSec != null) {
    secondary = `${gate.elapsedSec}s / ${gate.requiredSec}s`;
  } else if (gate?.speedKmh != null) {
    secondary = `${gate.speedKmh} km/h`;
  }
  return (
    <ListItem dense disableGutters>
      <ListItemIcon sx={{ minWidth: 32 }}>
        <Icon color={color} fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={gate?.label || '—'}
        secondary={secondary}
        primaryTypographyProps={{ variant: 'body2' }}
        secondaryTypographyProps={{ variant: 'caption' }}
      />
    </ListItem>
  );
}

function outcomeMessage(intent) {
  if (!intent) return null;
  const { status, confidence, executionError } = intent;
  if (status === 'completed') {
    if (confidence === 'relay_reported') {
      return 'Tracker reported a command result. Physical immobilization is still not guaranteed—verify operationally if required.';
    }
    if (confidence === 'sent' || confidence === 'acknowledged') {
      return 'Command submitted to tracking server. Device confirmation may still be pending.';
    }
    return 'Command delivery completed.';
  }
  if (status === 'failed') {
    return formatExecutionError(executionError) || 'Command delivery failed.';
  }
  if (status === 'expired') {
    return 'Immobilization request expired. Safe execution conditions were not reached in time.';
  }
  if (status === 'cancelled') {
    return 'Request was cancelled.';
  }
  if (['pending', 'monitoring'].includes(status)) {
    return 'Monitoring vehicle conditions. The command will be sent automatically when all safety gates pass.';
  }
  if (status === 'executing') {
    return 'Sending command to tracker…';
  }
  return null;
}

function ConfirmDialog({ open, title, body, confirmLabel, onClose, onConfirm, loading }) {
  return (
    <Dialog open={open} onClose={onClose} PaperProps={operationalDialogPaperProps} maxWidth="xs" fullWidth>
      <DialogTitle sx={operationalDialogTitleSx}>{title}</DialogTitle>
      <DialogContent sx={operationalDialogContentSx}>
        <Typography variant="body2" color="text.secondary">
          {body}
        </Typography>
      </DialogContent>
      <DialogActions sx={operationalDialogActionsSx}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onConfirm}
          disabled={loading}
          sx={operationalDialogPrimaryActionSx}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function VehicleImmobilizerPage() {
  const { classes } = useStyles();
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const manager = useManager();
  const deviceReadonly = useDeviceReadonly();

  const {
    vehicle,
    telemetry,
    loading: vehicleLoading,
    error: vehicleError,
    livePosition,
    deviceId,
    motionLabel,
    ignitionPhrase,
  } = useVehicleData(vehicleId);

  const {
    capabilities,
    activeIntent,
    history,
    loading: intentLoading,
    error: intentError,
    actionLoading,
    requestIntent,
    cancelActive,
  } = useImmobilizationIntent(vehicleId);

  const [confirmAction, setConfirmAction] = useState(null);

  if (!manager) {
    return (
      <Container maxWidth="md" className={classes.container}>
        <FleetWorkspaceShell>
          <Alert severity="info">Fleet vehicles are available to managers and administrators only.</Alert>
        </FleetWorkspaceShell>
      </Container>
    );
  }

  const detailPath = vehicleWorkspacePath(vehicleId);
  const title = vehicle?.plateNumber?.trim() || vehicle?.name || 'Vehicle';
  const online = vehicle?.device?.status === 'online';
  const speedKmh =
    livePosition?.speed != null
      ? Math.round(speedFromKnots(Number(livePosition.speed), 'kmh'))
      : telemetry?.speedKph != null
        ? Math.round(telemetry.speedKph)
        : null;

  const evaluation = activeIntent?.gateSnapshot?.evaluation;
  const gates = evaluation?.gates ? Object.values(evaluation.gates) : [];
  const capView = describeImmobilizationCapabilities(capabilities);
  const blocked = capView.mode !== 'ready' && capView.mode !== 'protocol_unsupported';
  const hasActive = activeIntent && ['pending', 'monitoring', 'executing'].includes(activeIntent.status);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    try {
      await requestIntent(confirmAction);
      setConfirmAction(null);
    } catch {
      /* error surfaced via intentError */
    }
  };

  return (
    <Container maxWidth="md" className={classes.container} sx={{ maxWidth: 720, mx: 'auto' }}>
      <FleetWorkspaceShell>
        {(vehicleLoading || intentLoading) && <LinearProgress sx={{ mb: 2 }} />}

        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(detailPath)}
          sx={{ textTransform: 'none', mb: 2 }}
        >
          Back to vehicle
        </Button>

        <Typography variant="h5" fontWeight={700} gutterBottom>
          Immobilizer
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {title}
          {deviceId != null ? ` · Tracker ${deviceId}` : ''}
        </Typography>

        {(vehicleError || intentError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {vehicleError || intentError}
          </Alert>
        )}

        {deviceReadonly && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your account is read-only. Immobilization actions are disabled.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={vehicleWorkspaceCardSx}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Vehicle context
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tracker: {online ? 'Online' : vehicle?.device?.status || 'Unknown'}
              {motionLabel ? ` · ${motionLabel}` : ''}
              {ignitionPhrase ? ` · ${ignitionPhrase}` : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Speed: {speedKmh != null ? `${speedKmh} km/h` : '—'}
            </Typography>
          </Box>

          <Box sx={vehicleWorkspaceCardSx}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Capabilities
            </Typography>
            {!deviceId ? (
              <Typography variant="body2" color="text.secondary">
                Assign a tracker in vehicle setup before using the immobilizer.
              </Typography>
            ) : blocked ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  {capView.summary}
                </Typography>
                {capView.detail && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {capView.detail}
                  </Typography>
                )}
              </>
            ) : (
              <Box>
                {capView.summary && (
                  <Typography variant="caption" color="success.main" display="block" sx={{ mb: 1 }}>
                    {capView.summary}
                  </Typography>
                )}
                {capView.detail && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    {capView.detail}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    size="small"
                    label={capabilities?.canImmobilize ? 'Engine stop supported' : 'Immobilize not supported'}
                    color={capabilities?.canImmobilize ? 'success' : 'default'}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={capabilities?.canMobilize ? 'Engine resume supported' : 'Mobilize not supported'}
                    color={capabilities?.canMobilize ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Box>
              </Box>
            )}
          </Box>

          {hasActive && (
            <Box sx={vehicleWorkspaceCardSx}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Safety gates
              </Typography>
              <List dense disablePadding>
                {gates.length > 0 ? (
                  gates.map((g) => <GateRow key={g.label} gate={g} />)
                ) : (
                  <ListItem dense disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                    </ListItemIcon>
                    <ListItemText primary="Waiting for first evaluation…" />
                  </ListItem>
                )}
              </List>
              <Chip
                size="small"
                label={activeIntent.status.toUpperCase()}
                sx={{ mt: 1 }}
              />
            </Box>
          )}

          {(activeIntent || history.length > 0) && (
            <Box sx={vehicleWorkspaceCardSx}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Status
              </Typography>
              {activeIntent && (
                <Alert
                  severity={
                    activeIntent.status === 'failed' ? 'error'
                      : activeIntent.status === 'completed' ? 'success'
                        : 'info'
                  }
                  sx={{ mb: 1 }}
                >
                  {outcomeMessage(activeIntent)}
                </Alert>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {!hasActive && (
              <>
                <Button
                  variant="contained"
                  color="warning"
                  disabled={
                    deviceReadonly
                    || actionLoading
                    || !capabilities?.canImmobilize
                    || !deviceId
                  }
                  onClick={() => setConfirmAction('immobilize')}
                >
                  Request immobilization
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  disabled={
                    deviceReadonly
                    || actionLoading
                    || !capabilities?.canMobilize
                    || !deviceId
                  }
                  onClick={() => setConfirmAction('mobilize')}
                >
                  Mobilize
                </Button>
              </>
            )}
            {hasActive && (
              <Button
                variant="outlined"
                color="inherit"
                disabled={deviceReadonly || actionLoading}
                onClick={() => cancelActive()}
              >
                Cancel request
              </Button>
            )}
            {deviceId != null && (
              <Button
                variant="text"
                size="small"
                onClick={() => navigate(`/settings/device/${deviceId}/command`)}
              >
                Advanced commands
              </Button>
            )}
            {deviceId != null && (
              <Button
                variant="text"
                size="small"
                onClick={() => navigate(`/reports/events?deviceId=${deviceId}`)}
              >
                Command events
              </Button>
            )}
          </Box>

          {history.length > 0 && (
            <Box sx={vehicleWorkspaceCardSx}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Recent requests
              </Typography>
              <List dense>
                {history.slice(0, 8).map((row) => {
                  const showMeta = row.status === 'completed' || row.status === 'failed';
                  const metaParts = [];
                  if (showMeta && row.deliveryPhase) {
                    metaParts.push(formatDeliveryPhase(row.deliveryPhase));
                  }
                  if (showMeta && row.executionAttempt > 0) {
                    metaParts.push(`Attempt ${row.executionAttempt}`);
                  }
                  if (showMeta && row.traccarHttpStatus != null) {
                    metaParts.push(`HTTP ${row.traccarHttpStatus}`);
                  }
                  return (
                    <ListItem key={row.id} disableGutters sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Typography variant="body2" fontWeight={600}>
                        {row.action} · {row.status}
                        {row.confidence && row.confidence !== 'unknown' ? ` · ${row.confidence}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                      </Typography>
                      {row.status === 'failed' && row.executionError && (
                        <Typography variant="caption" color="error.main" sx={{ mt: 0.25 }}>
                          {formatExecutionError(row.executionError)}
                        </Typography>
                      )}
                      {metaParts.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                          {metaParts.join(' · ')}
                        </Typography>
                      )}
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
        </Box>

        <ConfirmDialog
          open={confirmAction === 'immobilize'}
          title="Request immobilization"
          body="A safety-governed request will be created. The engine stop command is sent only when the tracker is online, telemetry is fresh, speed is low, and stability timers are satisfied. This does not guarantee the vehicle is physically immobilized until the tracker confirms."
          confirmLabel="Create request"
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
          loading={actionLoading}
        />
        <ConfirmDialog
          open={confirmAction === 'mobilize'}
          title="Request mobilization"
          body="Any pending immobilization request will be cancelled. A resume command will be sent when the tracker is online with fresh telemetry."
          confirmLabel="Mobilize"
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
          loading={actionLoading}
        />
      </FleetWorkspaceShell>
    </Container>
  );
}
