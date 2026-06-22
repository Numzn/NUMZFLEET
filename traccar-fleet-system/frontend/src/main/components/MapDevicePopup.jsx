import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { map } from '../../map/core/MapView';
import DeviceQuickActions from '../fleet/DeviceQuickActions';
import fleetDeviceIcon from '../fleet/fleetDeviceIcon.jsx';
import { useVehicleDisplayContext } from '../../fleet/display/VehicleDisplayRegistryContext';
import { getMotionDurationLabel, getMotionLabel } from '../../fleet/vehicleDetail/vehicleMotionStatus.js';
import VehicleLocationLine from '../../common/components/VehicleLocationLine';

/**
 * Lightweight anchored popup — mobile fallback; actions shared with fleet sidebar.
 */
const MapDevicePopup = ({
  device,
  position,
  fleetVehicleId,
  onClose,
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const { getDisplayForDevice } = useVehicleDisplayContext();
  const display = getDisplayForDevice(device?.id, device);

  useEffect(() => {
    if (!position?.longitude || !position?.latitude || !map || !map.loaded?.()) return undefined;

    const project = () => {
      try {
        const p = map.project([position.longitude, position.latitude]);
        setOffset({ x: p.x, y: p.y });
      } catch {
        /* ignore */
      }
    };

    project();
    map.on('move', project);
    map.on('zoom', project);
    map.on('resize', project);

    return () => {
      map.off('move', project);
      map.off('zoom', project);
      map.off('resize', project);
    };
  }, [position?.longitude, position?.latitude]);

  if (!device || !position || device.id == null) return null;

  const speedKmh = Math.round((position.speed || 0) * 1.852);
  const motionLabel = getMotionLabel(device.status, position.speed);
  const motionDuration = device.status === 'online'
    ? getMotionDurationLabel(device.id, device.status, position.speed)
    : null;
  const statusLine = [
    `${speedKmh} km/h`,
    motionDuration ? `${motionLabel} ${motionDuration}` : motionLabel,
  ].join(' · ');
  const hasFix = position.latitude != null && position.longitude != null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        left: offset.x,
        top: offset.y,
        transform: 'translate(-50%, calc(-100% - 14px))',
        zIndex: 1100,
        minWidth: 220,
        maxWidth: 300,
        p: 0.75,
        borderRadius: 2,
        pointerEvents: 'auto',
        border: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ pt: 0.15 }}>
          {fleetDeviceIcon(device, { fontSize: '1.1rem', color: 'primary.main' })}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} noWrap>
            {display.primary}
          </Typography>
          {display.secondary ? (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {display.secondary}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary" display="block">
            {statusLine}
          </Typography>
          {hasFix ? (
            <Typography
              component="div"
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block', mt: 0.25 }}
            >
              <VehicleLocationLine position={position} />
            </Typography>
          ) : null}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ mt: -0.5 }} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5, flexWrap: 'wrap', gap: 0.25 }}>
        <DeviceQuickActions device={device} position={position} fleetVehicleId={fleetVehicleId} justifyContent="flex-end" />
      </Box>
    </Paper>
  );
};

export default MapDevicePopup;
