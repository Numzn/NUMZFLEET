import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import useFeatures from '../../common/util/useFeatures.js';
import { vehicleModuleSx } from './dashboardCardSx.js';
import { useLinkedDrivers } from './useVehicleDriver.js';
import AssignDriverDialog from './AssignDriverDialog';

dayjs.extend(relativeTime);

export default function VehicleDriverSection({
  vehicle,
  deviceId,
  telemetry,
  onRefreshVehicle,
  embedded = false,
}) {
  const features = useFeatures();
  const { linkedDrivers, reloadLinked, loading } = useLinkedDrivers(deviceId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const linkedName = linkedDrivers?.[0]?.name?.trim();
  const fallbackName =
    vehicle?.device?.contact ||
    vehicle?.device?.driverName ||
    vehicle?.device?.attributes?.driverName ||
    null;
  const displayName = linkedName || fallbackName;

  const lastTs = telemetry?.fixTime || vehicle?.device?.lastUpdate;
  const lastActive = lastTs ? dayjs(lastTs).fromNow() : null;

  const shellSx = embedded ? { height: 'auto' } : [vehicleModuleSx, { height: 'auto' }];

  if (features.disableDrivers) {
    return (
      <Box sx={shellSx}>
        {!embedded && (
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Assigned driver
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Driver linking is disabled for this server profile. Use device fields where available.
        </Typography>
        {displayName && (
          <Typography variant="body1" fontWeight={600} sx={{ mt: 1 }}>
            {displayName}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <>
      <Box sx={shellSx}>
        {!embedded && (
          <Typography variant="subtitle1" fontWeight={700} gutterBottom display="flex" alignItems="center" gap={1}>
            <PersonOutlineIcon fontSize="small" />
            Assigned driver
          </Typography>
        )}
        {deviceId == null ? (
          <Typography variant="body2" color="text.secondary">
            Assign a Traccar device to this fleet vehicle before linking a driver.
          </Typography>
        ) : loading && !displayName ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : displayName ? (
          <>
            <Typography variant="body1" fontWeight={700}>
              {displayName}
            </Typography>
            {lastActive && (
              <Typography variant="body2" color="text.secondary">
                Last active {lastActive}
              </Typography>
            )}
            <Button variant="outlined" sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }} onClick={() => setDialogOpen(true)}>
              Change driver
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              No driver assigned
            </Typography>
            <Button variant="contained" sx={{ mt: 2, textTransform: 'none', fontWeight: 600 }} onClick={() => setDialogOpen(true)}>
              Assign driver
            </Button>
          </>
        )}
      </Box>
      <AssignDriverDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        deviceId={deviceId}
        linkedDrivers={linkedDrivers}
        reloadLinked={reloadLinked}
        onSaved={onRefreshVehicle}
      />
    </>
  );
}
