import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import {
  IconButton, Tooltip, Avatar, ListItemAvatar, ListItemButton,
  Typography, Box, Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import BatteryCharging60Icon from '@mui/icons-material/BatteryCharging60';
import Battery20Icon from '@mui/icons-material/Battery20';
import BatteryCharging20Icon from '@mui/icons-material/BatteryCharging20';
import ErrorIcon from '@mui/icons-material/Error';
import SpeedIcon from '@mui/icons-material/Speed';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { devicesActions } from '../store';
import {
  formatAlarm, formatBoolean, formatPercentage, formatStatus, getStatusColor,
} from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { mapIconKey, mapIcons } from '../map/core/preloadImages';
import { useAdministrator } from '../common/util/permissions';
import EngineIcon from '../resources/images/data/engine.svg';
import { useAttributePreference } from '../common/util/preferences';

dayjs.extend(relativeTime);

const useStyles = makeStyles()((theme) => ({
  deviceItem: {
    position: 'relative',
    borderRadius: theme.spacing(2),
    margin: theme.spacing(0, 1, 0.75, 1),
    padding: theme.spacing(1.15, 1.25),
    transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
    border: `1px solid ${alpha(theme.palette.divider, 0.75)}`,
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(145deg, rgba(9, 18, 33, 0.96) 0%, rgba(14, 27, 46, 0.94) 100%)'
      : 'linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(243, 249, 252, 0.96) 100%)',
    boxShadow: theme.palette.mode === 'dark'
      ? '0 10px 24px rgba(0, 0, 0, 0.2)'
      : '0 10px 24px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(12px)',
    '&:hover': {
      borderColor: alpha('#22d3ee', 0.34),
      boxShadow: theme.palette.mode === 'dark'
        ? '0 16px 32px rgba(0, 0, 0, 0.28)'
        : '0 16px 32px rgba(8, 47, 73, 0.12)',
      transform: 'translateY(-2px)',
    },
    '&:active': {
      transform: 'scale(0.98)',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      background: 'linear-gradient(90deg, rgba(34, 211, 238, 0.08), transparent 24%, transparent 76%, rgba(251, 191, 36, 0.06))',
      pointerEvents: 'none',
    },
  },
  deviceItemSelected: {
    background: 'linear-gradient(135deg, rgba(8, 83, 110, 0.96) 0%, rgba(11, 124, 145, 0.94) 52%, rgba(14, 165, 233, 0.92) 100%)',
    borderColor: alpha('#8be9f7', 0.48),
    color: '#f8fdff',
    boxShadow: '0 18px 36px rgba(8, 145, 178, 0.28)',
    '&:hover': {
      borderColor: alpha('#c8f7ff', 0.62),
      boxShadow: '0 20px 40px rgba(8, 145, 178, 0.34)',
    },
    '& .MuiAvatar-root': {
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.18)',
    },
  },
  avatar: {
    width: 42,
    height: 42,
    backgroundColor: alpha('#22d3ee', 0.12),
    border: `1px solid ${alpha('#22d3ee', 0.18)}`,
  },
  icon: {
    width: '20px',
    height: '20px',
    filter: 'brightness(0) saturate(100%) invert(70%) sepia(51%) saturate(2878%) hue-rotate(154deg) brightness(91%) contrast(101%)',
  },
  iconSelected: {
    filter: 'brightness(0) saturate(100%) invert(100%) opacity(0.94)',
  },
  contentWrap: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    gap: theme.spacing(1.25),
    position: 'relative',
    zIndex: 1,
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.625),
    fontSize: '0.7rem',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    display: 'inline-block',
    boxShadow: '0 0 0 4px rgba(255,255,255,0.06)',
  },
  deviceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.55),
  },
  titleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  titleBlock: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.2),
  },
  deviceName: {
    fontWeight: 700,
    fontSize: '0.88rem',
    lineHeight: 1.15,
    letterSpacing: '-0.015em',
  },
  deviceSecondary: {
    fontSize: '0.7rem',
    lineHeight: 1.2,
    color: alpha(theme.palette.text.secondary, 0.9),
  },
  selectedSecondary: {
    color: 'rgba(245, 252, 255, 0.76)',
  },
  deviceMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.85),
    fontSize: '0.7rem',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.45),
    padding: theme.spacing(0.45, 0.8),
    borderRadius: 999,
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(15, 23, 42, 0.05)',
  },
  indicators: {
    display: 'flex',
    gap: theme.spacing(0.5),
    alignItems: 'center',
    marginLeft: 'auto',
    flexShrink: 0,
    paddingLeft: theme.spacing(0.5),
  },
  statusChip: {
    height: 24,
    fontSize: '0.67rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderRadius: 999,
  },
  indicatorButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255,255,255,0.05)'
      : 'rgba(15,23,42,0.05)',
  },
  success: {
    color: theme.palette.success.main,
  },
  warning: {
    color: theme.palette.warning.main,
  },
  error: {
    color: theme.palette.error.main,
  },
  neutral: {
    color: theme.palette.neutral.main,
  },
}));

const DeviceRow = ({ devices, index, style }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const item = devices[index];
  const position = useSelector((state) => state.session.positions[item.id]);

  const devicePrimary = useAttributePreference('devicePrimary', 'name');
  const deviceSecondary = useAttributePreference('deviceSecondary', '');

  const isSelected = selectedDeviceId === item.id;

  const getStatusDotColor = () => {
    switch (item.status) {
      case 'online':
        return '#10b981';
      case 'offline':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = () => {
    if (item.status === 'online' || !item.lastUpdate) {
      return formatStatus(item.status, t);
    }
    return dayjs(item.lastUpdate).fromNow();
  };

  const getSpeed = () => {
    if (position && position.speed > 0) {
      return `${Math.round(position.speed * 1.852)} km/h`; // Convert knots to km/h
    }
    return null;
  };

  const secondaryValue = deviceSecondary && item[deviceSecondary] && item[deviceSecondary] !== item[devicePrimary]
    ? item[deviceSecondary]
    : item.uniqueId;

  const batteryLevel = position?.attributes?.batteryLevel;

  return (
    <div style={style}>
      <ListItemButton
        onClick={() => dispatch(devicesActions.selectId(item.id))}
        disabled={!admin && item.disabled}
        className={`${classes.deviceItem} ${isSelected ? classes.deviceItemSelected : ''}`}
      >
        <Box className={classes.contentWrap}>
          <ListItemAvatar sx={{ minWidth: 54 }}>
            <Avatar className={classes.avatar}>
              <img
                className={isSelected ? classes.iconSelected : classes.icon}
                src={mapIcons[mapIconKey(item.category)]}
                alt=""
              />
            </Avatar>
          </ListItemAvatar>

          <Box className={classes.deviceInfo} sx={{ flex: 1, minWidth: 0 }}>
            <Box className={classes.titleRow}>
              <Box className={classes.titleBlock}>
                <Typography className={classes.deviceName} noWrap>
                  {item[devicePrimary]}
                </Typography>
                <Typography className={`${classes.deviceSecondary} ${isSelected ? classes.selectedSecondary : ''}`} noWrap>
                  {secondaryValue}
                </Typography>
              </Box>
              <Chip
                label={formatStatus(item.status, t)}
                size="small"
                className={classes.statusChip}
                sx={{
                  backgroundColor: isSelected
                    ? 'rgba(255,255,255,0.14)'
                    : alpha(getStatusDotColor(), 0.12),
                  color: isSelected ? '#f8fdff' : getStatusDotColor(),
                  border: `1px solid ${isSelected ? 'rgba(255,255,255,0.14)' : alpha(getStatusDotColor(), 0.2)}`,
                }}
              />
            </Box>

            <Box className={classes.deviceMeta}>
              <Box className={classes.metaItem}>
                <Box
                  className={classes.statusDot}
                  sx={{ backgroundColor: getStatusDotColor() }}
                />
                <Typography
                  variant="caption"
                  className={isSelected ? undefined : classes[getStatusColor(item.status)]}
                  sx={{ color: isSelected ? 'rgba(248, 253, 255, 0.88)' : undefined, fontWeight: 700 }}
                >
                  {getStatusText()}
                </Typography>
              </Box>

              {getSpeed() && (
                <Box className={classes.metaItem}>
                  <SpeedIcon sx={{ fontSize: 14 }} />
                  <Typography variant="caption" fontWeight={700}>
                    {getSpeed()}
                  </Typography>
                </Box>
              )}

              {typeof batteryLevel === 'number' && (
                <Box className={classes.metaItem}>
                  <Typography variant="caption" fontWeight={700}>
                    Battery {formatPercentage(batteryLevel)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box className={classes.indicators}>
          {position && (
            <>
              {position.attributes.hasOwnProperty('alarm') && (
                <Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
                  <IconButton size="small" className={classes.indicatorButton}>
                    <ErrorIcon fontSize="small" className={classes.error} />
                  </IconButton>
                </Tooltip>
              )}
              {position.attributes.hasOwnProperty('ignition') && (
                <Tooltip title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}>
                  <IconButton size="small" className={classes.indicatorButton}>
                    {position.attributes.ignition ? (
                      <EngineIcon width={18} height={18} className={classes.success} />
                    ) : (
                      <EngineIcon width={18} height={18} className={classes.neutral} />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              {position.attributes.hasOwnProperty('batteryLevel') && (
                <Tooltip title={`${t('positionBatteryLevel')}: ${formatPercentage(position.attributes.batteryLevel)}`}>
                  <IconButton size="small" className={classes.indicatorButton}>
                    {(position.attributes.batteryLevel > 70 && (
                      position.attributes.charge
                        ? (<BatteryChargingFullIcon fontSize="small" className={classes.success} />)
                        : (<BatteryFullIcon fontSize="small" className={classes.success} />)
                    )) || (position.attributes.batteryLevel > 30 && (
                      position.attributes.charge
                        ? (<BatteryCharging60Icon fontSize="small" className={classes.warning} />)
                        : (<Battery60Icon fontSize="small" className={classes.warning} />)
                    )) || (
                      position.attributes.charge
                        ? (<BatteryCharging20Icon fontSize="small" className={classes.error} />)
                        : (<Battery20Icon fontSize="small" className={classes.error} />)
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
          </Box>
        </Box>
      </ListItemButton>
    </div>
  );
};

export default DeviceRow;
