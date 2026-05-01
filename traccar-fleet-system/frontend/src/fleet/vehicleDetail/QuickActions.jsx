import { Box, Button, Typography } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SmsIcon from '@mui/icons-material/Sms';
import MapIcon from '@mui/icons-material/Map';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { traccarFetch } from '../../config/traccarApi.js';
import { devicesActions, sessionActions } from '../../store';

import { vehicleDashboardCardSx } from './dashboardCardSx.js';

export default function QuickActions({ deviceId }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

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
    if (deviceId != null) {
      dispatch(devicesActions.selectId(deviceId));
    }
    navigate('/map');
  };

  return (
    <Box
      sx={[
        vehicleDashboardCardSx,
        {
          height: 'auto',
        },
      ]}
    >
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Quick actions
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<BlockIcon />}
          disabled={deviceId == null}
          onClick={() => deviceId != null && navigate(`/settings/device/${deviceId}/command`)}
          sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
        >
          Engine cut-off / commands
        </Button>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<MyLocationIcon />}
          onClick={refreshLive}
          sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
        >
          Refresh location
        </Button>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<SmsIcon />}
          disabled={deviceId == null}
          onClick={() => deviceId != null && navigate(`/settings/device/${deviceId}`)}
          sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
        >
          Send message to driver
        </Button>
        <Button
          variant="contained"
          fullWidth
          startIcon={<MapIcon />}
          onClick={openMap}
          sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
        >
          View on map
        </Button>
      </Box>
    </Box>
  );
}
