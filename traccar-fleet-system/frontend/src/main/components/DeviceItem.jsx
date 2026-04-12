import React from 'react';
import { 
  ListItemButton, 
  ListItemAvatar, 
  Avatar, 
  ListItemText, 
  Typography, 
  Box, 
  Chip
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import Battery20Icon from '@mui/icons-material/Battery20';
import ErrorIcon from '@mui/icons-material/Error';
import SpeedIcon from '@mui/icons-material/Speed';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { formatStatus, formatPercentage } from '../../common/util/formatter';
import { useTranslation } from '../../common/components/LocalizationProvider';

dayjs.extend(relativeTime);

const useStyles = makeStyles()((theme) => ({
  deviceItem: {
    borderRadius: theme.spacing(1.75),
    margin: theme.spacing(0.5, 0.75),
    padding: theme.spacing(0.95, 1.1),
    border: `1px solid ${alpha(theme.palette.divider, 0.75)}`,
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(145deg, rgba(7, 14, 28, 0.95) 0%, rgba(13, 24, 43, 0.93) 100%)'
      : 'linear-gradient(145deg, rgba(255, 255, 255, 0.97) 0%, rgba(243, 248, 252, 0.97) 100%)',
    boxShadow: theme.palette.mode === 'dark'
      ? '0 10px 26px rgba(0, 0, 0, 0.2)'
      : '0 10px 24px rgba(15, 23, 42, 0.08)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      borderColor: alpha('#22d3ee', 0.35),
      boxShadow: theme.palette.mode === 'dark'
        ? '0 14px 32px rgba(0, 0, 0, 0.28)'
        : '0 14px 32px rgba(8, 47, 73, 0.12)',
      transform: 'translateY(-1px)',
    },
  },
  deviceItemSelected: {
    background: 'linear-gradient(135deg, rgba(8, 83, 110, 0.96) 0%, rgba(11, 124, 145, 0.94) 52%, rgba(14, 165, 233, 0.9) 100%)',
    color: '#f8fdff',
    borderColor: alpha('#bff6ff', 0.55),
    boxShadow: '0 18px 36px rgba(8, 145, 178, 0.3)',
    '&:hover': {
      boxShadow: '0 20px 40px rgba(8, 145, 178, 0.36)',
    },
  },
  avatar: {
    width: 40,
    height: 40,
    fontSize: '0.75rem',
    border: `1px solid ${alpha('#22d3ee', 0.2)}`,
  },
  primaryText: {
    fontSize: '0.9rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  secondaryText: {
    fontSize: '0.74rem',
    lineHeight: 1.2,
    marginTop: theme.spacing(0.35),
  },
  statusChip: {
    height: 22,
    fontSize: '0.64rem',
    fontWeight: 700,
    borderRadius: 999,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  batteryIcon: {
    fontSize: '0.875rem',
  },
  speedIcon: {
    fontSize: '0.875rem',
  },
}));

const DeviceItem = ({ 
  device, 
  selected = false, 
  onClick,
  compact = false 
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  
  // Get position from Redux store
  const position = useSelector((state) => state.session.positions[device.id]);

  if (!device) return null;

  const getBatteryIcon = (batteryLevel) => {
    if (batteryLevel > 80) return <BatteryFullIcon className={classes.batteryIcon} />;
    if (batteryLevel > 60) return <Battery60Icon className={classes.batteryIcon} />;
    if (batteryLevel > 20) return <Battery20Icon className={classes.batteryIcon} />;
    return <ErrorIcon className={classes.batteryIcon} />;
  };

  const getBatteryColor = (batteryLevel) => {
    if (batteryLevel > 20) return theme.palette.success.main;
    return theme.palette.error.main;
  };

  const formatLastUpdate = (time) => {
    if (!time) return t('sharedNever');
    return dayjs(time).fromNow();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return theme.palette.success.main;
      case 'offline': return theme.palette.error.main;
      default: return theme.palette.text.secondary;
    }
  };

  return (
    <ListItemButton
      className={`${classes.deviceItem} ${selected ? classes.deviceItemSelected : ''}`}
      onClick={onClick}
      sx={{
        py: compact ? 0.5 : 1,
        px: compact ? 1 : 1.5,
        alignItems: 'flex-start',
      }}
    >
      <ListItemAvatar>
        <Avatar 
          className={classes.avatar}
          sx={{ 
            backgroundColor: getStatusColor(device.status),
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 600
          }}
        >
          {device.name?.charAt(0)?.toUpperCase() || 'D'}
        </Avatar>
      </ListItemAvatar>

      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
            <Typography className={classes.primaryText} noWrap>
              {device.name || device.uniqueId}
            </Typography>
            <Chip
              label={formatStatus(device.status, t)}
              size="small"
              className={classes.statusChip}
              sx={{
                backgroundColor: selected
                  ? 'rgba(255,255,255,0.16)'
                  : alpha(getStatusColor(device.status), 0.12),
                color: selected ? '#f8fdff' : getStatusColor(device.status),
                border: `1px solid ${selected ? 'rgba(255,255,255,0.18)' : alpha(getStatusColor(device.status), 0.22)}`,
              }}
            />
          </Box>
        }
        secondary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {position?.speed > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <SpeedIcon className={classes.speedIcon} />
                <Typography variant="caption">
                  {Math.round(position.speed)} km/h
                </Typography>
              </Box>
            )}
            
            {position?.batteryLevel && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                {getBatteryIcon(position.batteryLevel)}
                <Typography 
                  variant="caption" 
                  sx={{ color: getBatteryColor(position.batteryLevel) }}
                >
                  {formatPercentage(position.batteryLevel)}
                </Typography>
              </Box>
            )}

            <Typography variant="caption" color="text.secondary">
              {formatLastUpdate(position?.fixTime)}
            </Typography>
          </Box>
        }
      />
    </ListItemButton>
  );
};

export default DeviceItem;





