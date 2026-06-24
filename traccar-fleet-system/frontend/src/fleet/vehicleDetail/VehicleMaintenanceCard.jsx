import { useState } from 'react';
import {
  Box, Button, Chip, Typography, Divider,
} from '@mui/material';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { formatDistance } from '../../common/util/formatter';
import { useAttributePreference } from '../../common/util/preferences';
import { useTranslation } from '../../common/components/LocalizationProvider';
import CompleteMaintenanceDialog from './CompleteMaintenanceDialog.jsx';

function formatDue(item, { distanceUnit, t }) {
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
  canManage = false,
  onCompleted,
}) {
  const navigate = useNavigate();
  const t = useTranslation();
  const user = useSelector((state) => state.session.user);
  const distanceUnit = useAttributePreference('distanceUnit');
  const [selectedItem, setSelectedItem] = useState(null);

  const handleCloseDialog = () => setSelectedItem(null);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Maintenance schedule
          </Typography>
        </Box>
        {deviceId ? (
          <Button
            size="small"
            onClick={() => navigate(`/settings/maintenances?deviceId=${deviceId}`)}
          >
            Manage
          </Button>
        ) : null}
      </Box>

      {loading && (
        <Typography variant="body2" color="text.secondary">Loading schedules…</Typography>
      )}

      {!loading && items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No maintenance schedules linked to this vehicle.
        </Typography>
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
    </Box>
  );
}
