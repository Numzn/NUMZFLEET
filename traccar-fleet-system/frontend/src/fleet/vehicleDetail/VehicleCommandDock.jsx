import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import BlockIcon from '@mui/icons-material/Block';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SmsIcon from '@mui/icons-material/Sms';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import BuildIcon from '@mui/icons-material/Build';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { traccarFetch } from '../../config/traccarApi.js';
import { devicesActions, sessionActions } from '../../store';
import { vehicleModuleSx } from './dashboardCardSx.js';

export default function VehicleCommandDock({ deviceId, livePosition }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const hasDevice = deviceId != null;
  const hasFix = Boolean(livePosition?.latitude && livePosition?.longitude);

  const refreshLive = async () => {
    try {
      const [devicesResponse, positionsResponse] = await Promise.all([
        traccarFetch('/api/devices'),
        traccarFetch('/api/positions'),
      ]);
      if (devicesResponse.ok) {
        dispatch(devicesActions.refresh(await devicesResponse.json()));
      }
      if (positionsResponse.ok) {
        dispatch(sessionActions.updatePositions(await positionsResponse.json()));
      }
    } catch {
      /* ignore */
    }
  };

  const openMap = () => {
    if (!hasDevice) return;
    dispatch(devicesActions.selectId(deviceId));
    navigate('/map');
  };

  const scrollToId = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAnchorEl(null);
  };

  return (
    <Box
      sx={[
        vehicleModuleSx,
        {
          height: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
          py: 1.5,
          px: 2,
        },
      ]}
    >
      <Typography variant="subtitle2" fontWeight={700} sx={{ width: '100%', mb: 0.5 }}>
        Actions
      </Typography>
      <Tooltip title={hasFix ? 'Open live map with this vehicle selected' : 'No position yet — refresh or wait for fix'}>
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MyLocationIcon />}
            disabled={!hasDevice}
            onClick={openMap}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Locate
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Engine commands / immobilize">
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<BlockIcon />}
            disabled={!hasDevice}
            onClick={() => hasDevice && navigate(`/settings/device/${deviceId}/command`)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Immobilize
          </Button>
        </span>
      </Tooltip>
      <Tooltip title={livePosition ? 'Replay recent positions' : 'No position data yet'}>
        <span>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PlayArrowIcon />}
            disabled={!hasDevice || !livePosition}
            onClick={() => hasDevice && navigate(`/replay?deviceId=${deviceId}`)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Replay
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Device details & messaging">
        <span>
          <Button
            variant="contained"
            size="small"
            startIcon={<SmsIcon />}
            disabled={!hasDevice}
            onClick={() => hasDevice && navigate(`/settings/device/${deviceId}`)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Message
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="More options">
        <IconButton size="small" aria-label="More actions" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <MoreHorizIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          disabled={!hasDevice}
          onClick={() => {
            refreshLive();
            setAnchorEl(null);
          }}
        >
          Refresh location data
        </MenuItem>
        <MenuItem onClick={() => scrollToId('vehicle-section-health')}>Diagnostics & engine</MenuItem>
        <MenuItem onClick={() => scrollToId('vehicle-config-panel')}>Vehicle setup & configuration</MenuItem>
        <MenuItem
          disabled={!hasDevice}
          onClick={() => {
            setAnchorEl(null);
            hasDevice && navigate(`/settings/device/${deviceId}`);
          }}
        >
          <SettingsOutlinedIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Device settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate('/settings/notifications');
          }}
        >
          <NotificationsNoneIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Notifications
        </MenuItem>
        <MenuItem component="a" href="https://numz.site" target="_blank" rel="noopener noreferrer" onClick={() => setAnchorEl(null)}>
          <HelpOutlineIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Help
        </MenuItem>
        <MenuItem
          disabled={!hasDevice}
          onClick={() => {
            setAnchorEl(null);
            hasDevice && navigate(`/settings/device/${deviceId}/connections`);
          }}
        >
          <BuildIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Geofences & connections
        </MenuItem>
      </Menu>
    </Box>
  );
}
