import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PhoneIcon from '@mui/icons-material/Phone';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { map } from '../../map/core/MapView';
import { devicesActions } from '../../store';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useToastNotifications } from '../../hooks/useToastNotifications';
import { useVehicleDisplayContext } from '../../fleet/display/VehicleDisplayRegistryContext';
import { resolveKnownFleetVehicleId } from '../../fleet/display/resolveVehicleDisplay';
import { fleetActionButtonSx } from './mobile/fleetMobileCardSx';

export const easeInOutCirc = (t) => (
  t < 0.5
    ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2
);

/** Center map on live position (Focus / Track action). */
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
 * Device actions in two presentations:
 * - `icon` (default): compact Focus / Replay / More trio for sidebar + map popup.
 * - `labeled`: Track / Call Driver / More buttons for the mobile fleet cards.
 */
const DeviceQuickActions = ({
  device,
  position,
  fleetVehicleId,
  phone,
  variant = 'icon',
  justifyContent = 'flex-start',
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();
  const { showToast, ToastNotification } = useToastNotifications();
  const { byDeviceId, byFleetVehicleId } = useVehicleDisplayContext();

  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  if (!device?.id) return null;

  const deviceId = device.id;
  const hasFix = Boolean(position?.latitude && position?.longitude);

  const handleOpen = () => {
    setAnchorEl(null);
    const knownFleetVehicleId = resolveKnownFleetVehicleId(
      { byDeviceId, byFleetVehicleId },
      deviceId,
      fleetVehicleId,
    );
    if (knownFleetVehicleId) {
      navigate(`/fleet/vehicles/${encodeURIComponent(knownFleetVehicleId)}`);
      return;
    }
    showToast('Vehicle not registered in fleet manager', 'warning');
  };

  const handleReplay = () => {
    setAnchorEl(null);
    navigate(`/replay?deviceId=${deviceId}`);
  };

  if (variant === 'labeled') {
    const handleTrack = () => {
      dispatch(devicesActions.selectId(deviceId));
      focusMapOnPosition(position);
    };

    return (
      <>
        <ToastNotification />
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 'var(--space-1)', width: '100%', minWidth: 0 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MyLocationIcon sx={{ fontSize: '1rem' }} />}
            onClick={handleTrack}
            disabled={!hasFix}
            sx={fleetActionButtonSx}
          >
            Track
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PhoneIcon sx={{ fontSize: '1rem' }} />}
            component={phone ? 'a' : 'button'}
            href={phone ? `tel:${phone}` : undefined}
            disabled={!phone}
            sx={fleetActionButtonSx}
          >
            Call
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MoreHorizIcon sx={{ fontSize: '1rem' }} />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={fleetActionButtonSx}
          >
            More
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 140 } } }}
          >
            <MenuItem dense onClick={handleOpen}>Open</MenuItem>
            {position ? (
              <MenuItem dense onClick={handleReplay}>{t('reportReplay')}</MenuItem>
            ) : null}
          </Menu>
        </Box>
      </>
    );
  }

  return (
    <>
      <ToastNotification />
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent,
          gap: 0.25,
          minWidth: 0,
          '& .MuiIconButton-root': {
            margin: 0,
          },
        }}
      >
        {hasFix ? (
          <Tooltip title="Focus">
            <IconButton
              size="small"
              onClick={() => focusMapOnPosition(position)}
              aria-label="Focus"
              sx={{ p: 0.32 }}
            >
              <MyLocationIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
        ) : null}
        {position ? (
          <Tooltip title={t('reportReplay')}>
            <IconButton
              size="small"
              onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
              aria-label={t('reportReplay')}
              sx={{ p: 0.32 }}
            >
              <PlayArrowIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip title={t('sharedExtra')}>
          <span>
            <IconButton
              size="small"
              aria-label={t('sharedExtra')}
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ p: 0.32 }}
            >
              <MoreHorizIcon sx={{ fontSize: '1rem' }} />
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
    </>
  );
};

export default DeviceQuickActions;
