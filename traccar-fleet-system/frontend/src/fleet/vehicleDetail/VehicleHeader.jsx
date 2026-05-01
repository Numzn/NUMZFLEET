import { Box, Button, Chip, IconButton, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useNavigate } from 'react-router-dom';
import { vehicleTypeLabel } from './vehicleDetailSections.js';

const formatTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

function buildSubtitle(vehicle) {
  const model = vehicle?.name || vehicle?.device?.name;
  const ft = vehicle?.vehicleSpec?.fuelType;
  const vt = vehicleTypeLabel(vehicle?.fleetConfig?.vehicleType);
  const parts = [model, ft, vt].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(' • ') : '—';
}

export default function VehicleHeader({
  vehicle,
  lastUpdatedSource,
  deviceId,
  onOpenConfig,
}) {
  const navigate = useNavigate();
  const status = vehicle?.device?.status;
  const online = status === 'online';
  const title =
    vehicle?.plateNumber?.trim() || vehicle?.name || vehicle?.device?.name || 'Vehicle';
  const subtitle = buildSubtitle(vehicle);

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        mb: 1,
        pb: 2,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/fleet/vehicles')}
          sx={{ alignSelf: 'flex-start', textTransform: 'none', color: 'primary.light' }}
        >
          Back to Vehicles
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography
            variant="h4"
            component="h1"
            fontWeight={800}
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem' },
              letterSpacing: '0.02em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>
          {status && (
            <Chip
              size="small"
              label={online ? 'Online' : status}
              color={online ? 'success' : 'default'}
              variant={online ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700 }}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {subtitle}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'row', sm: 'column' },
          alignItems: { xs: 'center', sm: 'flex-end' },
          gap: 1.5,
          flexWrap: 'wrap',
          justifyContent: { xs: 'flex-start', sm: 'flex-end' },
        }}
      >
        <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Last updated
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {formatTime(lastUpdatedSource)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            aria-label="Notifications"
            onClick={() => navigate('/settings/notifications')}
          >
            <NotificationsNoneIcon />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Help"
            component="a"
            href="https://numz.site"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HelpOutlineIcon />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Device settings"
            disabled={deviceId == null}
            onClick={() => deviceId != null && navigate(`/settings/device/${deviceId}`)}
          >
            <SettingsOutlinedIcon />
          </IconButton>
          <Button
            variant="contained"
            size="medium"
            onClick={onOpenConfig}
            sx={{ ml: 0.5, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Config
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
