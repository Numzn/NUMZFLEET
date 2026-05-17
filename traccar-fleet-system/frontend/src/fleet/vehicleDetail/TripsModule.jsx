import { Box, Button, Typography } from '@mui/material';
import PlayArrowFilledIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';
import { vehicleModuleSx } from './dashboardCardSx.js';

/**
 * Mobile “Trips” tab: replay-focused surface. Trip overview lives in the hero (Live tab).
 */
export default function TripsModule({ deviceId }) {
  const navigate = useNavigate();

  return (
    <Box sx={[vehicleModuleSx, { height: 'auto' }]}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Trips
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Speed, trip leg, and route context are shown in the hero on the Live tab. Use replay for recent movement history.
      </Typography>
      <Button
        variant="contained"
        fullWidth
        startIcon={<PlayArrowFilledIcon />}
        disabled={deviceId == null}
        onClick={() => deviceId != null && navigate(`/replay?deviceId=${deviceId}`)}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Replay
      </Button>
    </Box>
  );
}
