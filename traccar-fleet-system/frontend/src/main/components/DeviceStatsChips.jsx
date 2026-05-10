import React, { useState, useCallback } from 'react';
import { 
  Box, 
  Chip, 
  Tooltip, 
  Fade, 
  Zoom,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CircleIcon from '@mui/icons-material/Circle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PauseIcon from '@mui/icons-material/Pause';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const useStyles = makeStyles()((theme) => ({
  statsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  statChip: {
    height: '32px',
    fontSize: '0.75rem',
    fontWeight: 600,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
    },
    '&:active': {
      transform: 'translateY(0)',
    },
  },
  onlineChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    color: '#10b981',
    '&:hover': {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderColor: 'rgba(16, 185, 129, 0.5)',
    },
  },
  movingChip: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
    color: '#06b6d4',
    '&:hover': {
      backgroundColor: 'rgba(6, 182, 212, 0.2)',
      borderColor: 'rgba(6, 182, 212, 0.5)',
    },
  },
  idleChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    color: '#f59e0b',
    '&:hover': {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      borderColor: 'rgba(245, 158, 11, 0.5)',
    },
  },
  offlineChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    '&:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderColor: 'rgba(239, 68, 68, 0.5)',
    },
  },
  compactChip: {
    height: '28px',
    fontSize: '0.7rem',
    '& .MuiChip-label': {
      padding: theme.spacing(0, 1),
    },
  },
  icon: {
    fontSize: '14px',
    marginRight: theme.spacing(0.5),
  },
  tooltip: {
    fontSize: '0.75rem',
    fontWeight: 500,
  },
}));

const DeviceStatsChips = ({ 
  stats = {}, 
  onFilterClick,
  compact = false,
  showTooltips = true 
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [hoveredChip, setHoveredChip] = useState(null);

  const {
    total = 0,
    online = 0,
    moving = 0,
    idling = 0,
    offline = 0
  } = stats;

  const handleChipClick = useCallback((filterType) => {
    if (onFilterClick) {
      onFilterClick(filterType);
    }
  }, [onFilterClick]);

  const handleChipHover = useCallback((chipType) => {
    setHoveredChip(chipType);
  }, []);

  const handleChipLeave = useCallback(() => {
    setHoveredChip(null);
  }, []);

  const chipProps = {
    variant: 'outlined',
    size: compact ? 'small' : 'medium',
    className: `${classes.statChip} ${compact ? classes.compactChip : ''}`,
    onClick: handleChipClick,
    onMouseEnter: handleChipHover,
    onMouseLeave: handleChipLeave,
  };

  const getTooltipContent = (type, count) => {
    const tooltips = {
      online: `Online devices: ${count} active`,
      moving: `Moving devices: ${count} in motion`,
      idle: `Idle devices: ${count} stationary`,
      offline: `Offline devices: ${count} disconnected`,
    };
    return tooltips[type] || '';
  };

  const StatChip = ({ type, count, label, icon, chipClass, filterType }) => {
    const chip = (
      <Chip
        {...chipProps}
        icon={icon}
        label={`${count} ${label}`}
        className={`${chipClass} ${chipProps.className}`}
        onClick={() => handleChipClick(filterType)}
      />
    );

    if (showTooltips) {
      return (
        <Tooltip 
          title={getTooltipContent(type, count)}
          classes={{ tooltip: classes.tooltip }}
          arrow
          placement="bottom"
        >
          {chip}
        </Tooltip>
      );
    }

    return chip;
  };

  // Don't render if no devices
  if (total === 0) {
    return null;
  }

  return (
    <Box className={classes.statsContainer}>
      {/* Online Devices */}
      {online > 0 && (
        <Fade in timeout={300}>
          <Zoom in={hoveredChip === 'online'} timeout={200}>
            <Box>
              <StatChip
                type="online"
                count={online}
                label="Online"
                icon={<CircleIcon className={classes.icon} />}
                chipClass={classes.onlineChip}
                filterType="online"
              />
            </Box>
          </Zoom>
        </Fade>
      )}

      {/* Moving Devices */}
      {moving > 0 && (
        <Fade in timeout={400}>
          <Zoom in={hoveredChip === 'moving'} timeout={200}>
            <Box>
              <StatChip
                type="moving"
                count={moving}
                label="Moving"
                icon={<TrendingUpIcon className={classes.icon} />}
                chipClass={classes.movingChip}
                filterType="moving"
              />
            </Box>
          </Zoom>
        </Fade>
      )}

      {/* Idle Devices */}
      {idling > 0 && (
        <Fade in timeout={500}>
          <Zoom in={hoveredChip === 'idle'} timeout={200}>
            <Box>
              <StatChip
                type="idle"
                count={idling}
                label="Idle"
                icon={<PauseIcon className={classes.icon} />}
                chipClass={classes.idleChip}
                filterType="idle"
              />
            </Box>
          </Zoom>
        </Fade>
      )}

      {/* Offline Devices */}
      {offline > 0 && (
        <Fade in timeout={600}>
          <Zoom in={hoveredChip === 'offline'} timeout={200}>
            <Box>
              <StatChip
                type="offline"
                count={offline}
                label="Offline"
                icon={<ErrorOutlineIcon className={classes.icon} />}
                chipClass={classes.offlineChip}
                filterType="offline"
              />
            </Box>
          </Zoom>
        </Fade>
      )}
    </Box>
  );
};

export default DeviceStatsChips;
