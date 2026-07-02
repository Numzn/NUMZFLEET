import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useSelector } from 'react-redux';
import { vehicleDashboardCardSx } from './dashboardCardSx.js';
import { vehicleSetupPath } from '../vehicleRegistry/vehicleRegistryUtils.js';
import {
  ROUTINE_SERVICE_CHECKLIST,
  ROUTINE_SERVICE_LABEL,
  ROUTINE_SERVICE_STATUS_COLORS,
} from '../routineServiceConstants.js';
import { useNavigate } from 'react-router-dom';
import CompleteMaintenanceDialog from './CompleteMaintenanceDialog.jsx';
import OperationalItemPanel from './OperationalItemPanel.jsx';

function fmtKm(km) {
  if (km == null || !Number.isFinite(Number(km))) return '—';
  return `${Math.round(Number(km)).toLocaleString()} km`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function MetricRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

export default function RoutineServiceOpsPanel({
  nextService,
  routineServiceConfigured,
  currentOdometerKm,
  routineScheduleItem,
  fleetVehicleId,
  deviceId,
  canManage,
  onCompleted,
  user,
  loading,
}) {
  const navigate = useNavigate();
  const sessionUser = useSelector((state) => state.session.user);
  const completeUser = user ?? sessionUser;
  const [completeOpen, setCompleteOpen] = useState(false);

  const statusColor = ROUTINE_SERVICE_STATUS_COLORS[nextService?.status] || 'default';
  const lastService = nextService?.lastService;

  const maintenanceItemForComplete = useMemo(() => {
    if (!routineScheduleItem) return null;
    return {
      ...routineScheduleItem,
      name: ROUTINE_SERVICE_LABEL,
    };
  }, [routineScheduleItem]);

  if (loading) {
    return (
      <Box sx={vehicleDashboardCardSx}>
        <Typography variant="body2" color="text.secondary">Loading Routine Service…</Typography>
      </Box>
    );
  }

  if (!routineServiceConfigured || !nextService) {
    return (
      <Box sx={vehicleDashboardCardSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <BuildOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Routine Service
          </Typography>
        </Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          No Routine Service configured for this vehicle.
        </Alert>
        {fleetVehicleId && (
          <Button
            variant="contained"
            startIcon={<SettingsOutlinedIcon />}
            onClick={() => navigate(vehicleSetupPath(fleetVehicleId))}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Configure in Vehicle Setup
          </Button>
        )}
      </Box>
    );
  }

  const nextServiceSummary = nextService.nextServiceAtKm != null
    ? `Next service at ${fmtKm(nextService.nextServiceAtKm)}`
    : 'Next service';

  return (
    <>
      <OperationalItemPanel
        title={ROUTINE_SERVICE_LABEL}
        subtitle="Daily maintenance — interval changes are made in Vehicle Setup only."
        icon={BuildOutlinedIcon}
        statusLabel={nextService.statusLabel || '—'}
        statusColor={statusColor}
        summaryPrimary={nextService.dueLabel || '—'}
        summarySecondary={nextServiceSummary}
        defaultExpanded={['due_soon', 'prepare', 'due_now', 'overdue'].includes(nextService.status)}
      >
        <MetricRow label="Status" value={nextService.statusLabel || '—'} />
        <MetricRow label="Current Odometer" value={fmtKm(currentOdometerKm)} />
        <MetricRow label="Next Service At" value={fmtKm(nextService.nextServiceAtKm)} />
        <MetricRow label="Remaining Distance" value={fmtKm(nextService.remainingKm)} />
        <MetricRow
          label="Last Service"
          value={
            lastService?.completedAt
              ? `${fmtDate(lastService.completedAt)}${lastService.odometerKm != null ? ` · ${fmtKm(lastService.odometerKm)}` : ''}`
              : '—'
          }
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Checklist
        </Typography>
        <List dense disablePadding sx={{ mb: 2 }}>
          {ROUTINE_SERVICE_CHECKLIST.map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.25 }}>
              <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItem>
          ))}
        </List>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {canManage && maintenanceItemForComplete ? (
            <Button
              variant="contained"
              onClick={() => setCompleteOpen(true)}
              disabled={maintenanceItemForComplete.unknown}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Complete Service
            </Button>
          ) : null}
          {fleetVehicleId ? (
            <Button
              variant="outlined"
              startIcon={<SettingsOutlinedIcon />}
              onClick={() => navigate(vehicleSetupPath(fleetVehicleId))}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Edit Routine Service Settings
            </Button>
          ) : null}
        </Box>

        {maintenanceItemForComplete?.unknown ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            Awaiting odometer data before service can be completed.
          </Typography>
        ) : null}
      </OperationalItemPanel>

      {maintenanceItemForComplete && fleetVehicleId ? (
        <CompleteMaintenanceDialog
          open={completeOpen}
          maintenanceItem={maintenanceItemForComplete}
          fleetVehicleId={fleetVehicleId}
          user={completeUser}
          registryOdometerKm={currentOdometerKm}
          routineServiceMode
          onClose={() => setCompleteOpen(false)}
          onCompleted={async () => {
            setCompleteOpen(false);
            await onCompleted?.();
          }}
        />
      ) : null}
    </>
  );
}
