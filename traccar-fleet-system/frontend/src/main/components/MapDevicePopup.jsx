import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TwoWheelerIcon from '@mui/icons-material/TwoWheeler';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useNavigate } from 'react-router-dom';
import { map } from '../../map/core/MapView';

const easeInOutCirc = (t) => (
  t < 0.5
    ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2
);

function deviceIcon(device, sx) {
  const c = (device.category || device.attributes?.deviceType)?.toLowerCase?.();
  if (c === 'truck' || c === 'van') return <LocalShippingIcon sx={sx} />;
  if (c === 'motorcycle' || c === 'bike') return <TwoWheelerIcon sx={sx} />;
  return <DirectionsCarIcon sx={sx} />;
}

/**
 * Lightweight anchored popup — identity, speed, compact actions (no expandable dashboard).
 */
const MapDevicePopup = ({
  device,
  position,
  onClose,
}) => {
  const navigate = useNavigate();
  const [offset, setOffset] = useState({ x: 0, y: 0 });

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

  const handleFocus = () => {
    map.easeTo({
      center: [position.longitude, position.latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: 900,
      easing: easeInOutCirc,
      essential: true,
    });
  };

  const actions = (
    <>
      <Tooltip title="Focus map">
        <IconButton size="small" onClick={handleFocus} aria-label="Focus">
          <MyLocationIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Replay">
        <IconButton size="small" onClick={() => navigate(`/replay?deviceId=${device.id}`)} aria-label="Replay">
          <PlayArrowIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Details">
        <IconButton size="small" onClick={() => navigate(`/settings/device/${device.id}`)} aria-label="Details">
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );

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
        maxWidth: 280,
        p: 1,
        borderRadius: 2,
        pointerEvents: 'auto',
        border: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ pt: 0.25 }}>
          {deviceIcon(device, { fontSize: '1.25rem', color: 'primary.main' })}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={800} noWrap>
            {device.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {speedKmh}
            {' '}
            km/h ·
            {' '}
            {device.status === 'online' ? 'Online' : 'Offline'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ mt: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25, mt: 0.75 }}>
        {actions}
      </Box>
    </Paper>
  );
};

export default MapDevicePopup;
