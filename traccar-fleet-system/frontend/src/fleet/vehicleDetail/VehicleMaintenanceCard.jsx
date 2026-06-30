import { useState } from 'react';
import {
  Box, Button, Chip, Typography, Divider, Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { formatDistance } from '../../common/util/formatter';
import { useAttributePreference } from '../../common/util/preferences';
import { useTranslation } from '../../common/components/LocalizationProvider';
import CompleteMaintenanceDialog from './CompleteMaintenanceDialog.jsx';
import NewWorkOrderDialog from '../../maintenance/components/NewWorkOrderDialog.jsx';
import AddMaintenanceScheduleDialog from '../../maintenance/components/AddMaintenanceScheduleDialog.jsx';
import { createWorkOrder } from '../../maintenance/maintenanceApi.js';
import WorkOrderStatusChip from '../../maintenance/components/WorkOrderStatusChip.jsx';

function formatDue(item, { distanceUnit, t }) {
  if (item.remainingLabel) return item.remainingLabel;
  if (item.unknown || item.remaining == null) return 'Awaiting odometer data';
  if (item.isOverdue) return 'Due now';
  if (item.isTime) {
    const days = Math.round(item.remaining / 86400000);
    return `${days} days remaining`;
  }
  if (item.type === 'totalDistance') {
    return `${formatDistance(item.remaining, distanceUnit, t)} remaining`;
  }
  if (item.type === 'hours' || item.type === 'drivingTime') {
    return `${Math.round(item.remaining / 3600000)} h remaining`;
  }
  return `${Math.round(item.remaining)} remaining`;
}

export default function VehicleMaintenanceCard({
  items,
  loading,
  deviceId,
  fleetVehicleId,
  currentOdometerMeters,
  openWorkOrders = [],
  canManage = false,
  onCompleted,
  embedded = false,
}) {
  const navigate = useNavigate();
  const t = useTranslation();
  const user = useSelector((state) => state.session.user);
  const distanceUnit = useAttributePreference('distanceUnit');
  const [selectedItem, setSelectedItem] = useState(null);
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const handleCloseDialog = () => setSelectedItem(null);

  const handleCreateWorkOrder = async (vehicleId, payload) => {
    await createWorkOrder(user, vehicleId, payload);
    await onCompleted?.();
  };

  return (
    <Box>
      {!embedded && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Maintenance schedule
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {canManage && deviceId ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setScheduleDialogOpen(true)}
            >
              Add schedule
            </Button>
          ) : null}
          {canManage && fleetVehicleId ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setWoDialogOpen(true)}
            >
              New work order
            </Button>
          ) : null}
          {fleetVehicleId ? (
            <Button
              size="small"
              onClick={() => navigate(`/maintenance?fleetVehicleId=${fleetVehicleId}`)}
            >
              Fleet maintenance
            </Button>
          ) : deviceId ? (
            <Button size="small" onClick={() => navigate('/maintenance')}>
              Fleet maintenance
            </Button>
          ) : null}
        </Box>
      </Box>
      )}

      {embedded && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
          {canManage && deviceId ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setScheduleDialogOpen(true)}
            >
              Add schedule
            </Button>
          ) : null}
          {canManage && fleetVehicleId ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setWoDialogOpen(true)}
            >
              New work order
            </Button>
          ) : null}
          {fleetVehicleId ? (
            <Button
              size="small"
              onClick={() => navigate(`/maintenance?fleetVehicleId=${fleetVehicleId}`)}
            >
              Fleet maintenance
            </Button>
          ) : null}
        </Box>
      )}

      {loading && (
        <Typography variant="body2" color="text.secondary">Loading schedules…</Typography>
      )}

      {!loading && items.length === 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No service reminders yet. Add a schedule to power
            {' '}
            <strong>Next Service Due In</strong>
            {' '}
            on the overview.
          </Typography>
          {canManage && deviceId ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setScheduleDialogOpen(true)}
            >
              Add your first schedule
            </Button>
          ) : null}
        </Box>
      )}

      {!loading && items.map((item, idx) => (
        <Box key={item.id}>
          {idx > 0 ? <Divider sx={{ my: 1 }} /> : null}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDue(item, { distanceUnit, t })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              {item.isOverdue ? (
                <Chip size="small" color="error" label="Due now" />
              ) : item.dueSoon ? (
                <Chip size="small" color="warning" label="Due soon" />
              ) : null}
              {canManage && item.isActionable && fleetVehicleId ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedItem(item)}
                >
                  Mark complete
                </Button>
              ) : null}
            </Box>
          </Box>
        </Box>
      ))}

      {openWorkOrders.length > 0 ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Open work orders ({openWorkOrders.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {openWorkOrders.map((wo) => (
              <Paper key={wo.id} variant="outlined" sx={{ p: 1.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {wo.workOrderNumber || `WO-${wo.id}`} · {wo.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {wo.workshop || 'No workshop'}
                      {wo.assignee ? ` · ${wo.assignee}` : ''}
                    </Typography>
                  </Box>
                  <WorkOrderStatusChip status={wo.status} />
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      ) : null}

      {selectedItem && fleetVehicleId ? (
        <CompleteMaintenanceDialog
          open
          maintenanceItem={selectedItem}
          fleetVehicleId={fleetVehicleId}
          user={user}
          onClose={handleCloseDialog}
          onCompleted={async () => {
            handleCloseDialog();
            await onCompleted?.();
          }}
        />
      ) : null}

      {canManage && deviceId ? (
        <AddMaintenanceScheduleDialog
          open={scheduleDialogOpen}
          onClose={() => setScheduleDialogOpen(false)}
          deviceId={deviceId}
          currentOdometerMeters={currentOdometerMeters}
          onCreated={onCompleted}
        />
      ) : null}

      {canManage && fleetVehicleId ? (
        <NewWorkOrderDialog
          open={woDialogOpen}
          onClose={() => setWoDialogOpen(false)}
          user={user}
          initialVehicleId={fleetVehicleId}
          onSubmit={async (vehicleId, payload) => {
            await handleCreateWorkOrder(vehicleId, payload);
            setWoDialogOpen(false);
          }}
        />
      ) : null}
    </Box>
  );
}
