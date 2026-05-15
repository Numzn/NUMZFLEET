import { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';
import { map } from '../../map/core/MapView';
import { useTranslation } from '../../common/components/LocalizationProvider';

export const easeInOutCirc = (t) => (
  t < 0.5
    ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2
);

/** Center map on live position (Focus action). */
export function focusMapOnPosition(position, minZoom = 12) {
  if (!position?.longitude || !position?.latitude || !map?.loaded?.()) return;
  map.easeTo({
    center: [position.longitude, position.latitude],
    zoom: Math.max(map.getZoom(), minZoom),
    duration: 900,
    easing: easeInOutCirc,
    essential: true,
  });
}

/**
 * Tactical trio: Focus / Replay / More (Open only).
 * Keeps sidebar + popup aligned without heavy overflow menus.
 */
const DeviceQuickActions = ({
  device,
  position,
  fleetVehicleId,
  justifyContent = 'flex-start',
}) => {
  const navigate = useNavigate();
  const t = useTranslation();

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  if (!device?.id) return null;

  const deviceId = device.id;
  const hasFix = Boolean(position?.latitude && position?.longitude);
  const openPath = fleetVehicleId
    ? `/fleet/vehicles/${encodeURIComponent(fleetVehicleId)}`
    : `/settings/device/${deviceId}`;

  const handleOpen = () => {
    setAnchorEl(null);
    navigate(openPath);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent,
        gap: 0.15,
        minWidth: 0,
      }}
    >
      {hasFix ? (
        <Tooltip title="Focus">
          <IconButton
            size="small"
            onClick={() => focusMapOnPosition(position)}
            aria-label="Focus"
            sx={{ p: 0.35 }}
          >
            <MyLocationIcon sx={{ fontSize: '1.05rem' }} />
          </IconButton>
        </Tooltip>
      ) : null}
      {position ? (
        <Tooltip title={t('reportReplay')}>
          <IconButton
            size="small"
            onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
            aria-label={t('reportReplay')}
            sx={{ p: 0.35 }}
          >
            <PlayArrowIcon sx={{ fontSize: '1.05rem' }} />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title={t('sharedExtra')}>
        <span>
          <IconButton
            size="small"
            aria-label={t('sharedExtra')}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ p: 0.35 }}
          >
            <MoreHorizIcon sx={{ fontSize: '1.05rem' }} />
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 140 } } }}
      >
        <MenuItem dense onClick={handleOpen}>
          Open
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default DeviceQuickActions;
