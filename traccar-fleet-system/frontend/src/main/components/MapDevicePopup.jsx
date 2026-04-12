import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Collapse,
  Button,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TwoWheelerIcon from '@mui/icons-material/TwoWheeler';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BarChartIcon from '@mui/icons-material/BarChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { map } from '../../map/core/MapView';

const useStyles = makeStyles()((theme) => ({
  popup: {
    position: 'absolute',
    zIndex: 1000,
    minWidth: 260,
    maxWidth: 340,
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(155deg, rgba(6, 14, 26, 0.96) 0%, rgba(12, 28, 46, 0.95) 100%)'
      : 'linear-gradient(155deg, rgba(255, 255, 255, 0.97) 0%, rgba(243, 249, 253, 0.97) 100%)',
    borderRadius: theme.spacing(2),
    boxShadow: theme.palette.mode === 'dark'
      ? '0 26px 58px rgba(0, 0, 0, 0.38)'
      : '0 24px 52px rgba(15, 23, 42, 0.16)',
    border: `1px solid rgba(103, 232, 249, 0.24)`,
    overflow: 'hidden',
    userSelect: 'none',
    cursor: 'move',
    transition: 'all 0.2s ease',
    '&:hover': {
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
    },
  },
  dragHandle: {
    width: '100%',
    height: 8,
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(90deg, rgba(103,232,249,0.18), rgba(251,191,36,0.1))'
      : 'linear-gradient(90deg, rgba(6,182,212,0.18), rgba(245,158,11,0.1))',
    cursor: 'move',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&::before': {
      content: '"▬▬▬▬▬▬▬▬▬▬▬▬"',
      fontSize: '8px',
      color: theme.palette.text.secondary,
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.15, 1.6),
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(180deg, rgba(14, 33, 52, 0.94) 0%, rgba(8, 18, 30, 0.9) 100%)'
      : 'linear-gradient(180deg, rgba(236, 249, 253, 0.92) 0%, rgba(247, 252, 255, 0.9) 100%)',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  deviceInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  deviceIcon: {
    fontSize: '1.2rem',
  },
  deviceName: {
    fontWeight: 700,
    fontSize: '0.95rem',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginLeft: theme.spacing(0.5),
  },
  statusOnline: {
    backgroundColor: theme.palette.success.main,
  },
  statusOffline: {
    backgroundColor: theme.palette.error.main,
  },
  statusUnknown: {
    backgroundColor: theme.palette.grey[500],
  },
  content: {
    padding: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.1),
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(0.75),
  },
  metricCard: {
    borderRadius: theme.spacing(1.1),
    padding: theme.spacing(0.75, 0.85),
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    background: theme.palette.mode === 'dark'
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(15,23,42,0.03)',
  },
  metricLabel: {
    fontSize: '0.66rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.25),
    fontWeight: 600,
  },
  metricValue: {
    fontSize: '0.84rem',
    fontWeight: 700,
    lineHeight: 1.15,
  },
  detailRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.75),
    fontSize: '0.78rem',
    padding: theme.spacing(0.5, 0),
  },
  infoIcon: {
    fontSize: '0.85rem',
    width: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  infoText: {
    fontSize: '0.76rem',
    color: theme.palette.text.secondary,
    lineHeight: 1.35,
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(0.6),
    marginTop: theme.spacing(0.35),
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    minHeight: 34,
    padding: theme.spacing(0.55, 0.8),
    borderRadius: theme.spacing(1.1),
    textTransform: 'none',
    fontSize: '0.72rem',
    fontWeight: 700,
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(103, 232, 249, 0.12)'
      : 'rgba(6, 182, 212, 0.1)',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark'
        ? 'rgba(103, 232, 249, 0.2)'
        : 'rgba(6, 182, 212, 0.2)',
    },
  },
  expandButton: {
    width: '100%',
    marginTop: theme.spacing(1),
    fontSize: '0.75rem',
    textTransform: 'none',
    color: theme.palette.primary.main,
  },
  expandedContent: {
    paddingTop: theme.spacing(0.7),
    borderTop: `1px solid ${theme.palette.divider}`,
    marginTop: theme.spacing(0.5),
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    cursor: 'nw-resize',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 0,
      height: 0,
      borderLeft: '4px solid transparent',
      borderBottom: '4px solid',
      borderBottomColor: theme.palette.divider,
    },
  },
}));

const MapDevicePopup = ({ 
  device, 
  position, 
  onClose,
  initialPosition = { x: 100, y: 100 }
}) => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  
  const [popupPosition, setPopupPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const popupRef = useRef(null);

  // Get device icon based on type
  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'truck':
      case 'van':
        return <LocalShippingIcon className={classes.deviceIcon} />;
      case 'motorcycle':
      case 'bike':
        return <TwoWheelerIcon className={classes.deviceIcon} />;
      default:
        return <DirectionsCarIcon className={classes.deviceIcon} />;
    }
  };

  // Get status color
  const getStatusClass = (status) => {
    switch (status) {
      case 'online':
        return classes.statusOnline;
      case 'offline':
        return classes.statusOffline;
      default:
        return classes.statusUnknown;
    }
  };

  // Format time ago
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'No data';
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Handle drag start
  const handleDragStart = (e) => {
    setIsDragging(true);
    const rect = popupRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Handle drag move
  const handleDragMove = (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep popup within viewport bounds
    const maxX = window.innerWidth - 360;
    const maxY = window.innerHeight - 200;
    
    setPopupPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Add event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e) => handleDragMove(e);
      const handleMouseUp = () => handleDragEnd();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Quick actions
  const handleFocusOnMap = () => {
    if (position && position.latitude && position.longitude) {
      // Focus map on device position with smooth animation
      map.easeTo({
        center: [position.longitude, position.latitude],
        zoom: Math.max(map.getZoom(), 12), // Ensure minimum zoom level
        duration: 1000, // 1 second smooth animation
      });
    }
  };

  const handleStartTracking = () => {
    navigate(`/replay?deviceId=${device.id}`);
  };

  const handleShowStats = () => {
    navigate(`/settings/device/${device.id}`);
  };

  if (!device || !position) {
    if (process.env.NODE_ENV === 'development') {
      console.log('MapDevicePopup: Missing device or position', { device, position });
    }
    return null;
  }

  // Additional safety checks
  if (!device.id || !device.name) {
    if (process.env.NODE_ENV === 'development') {
      console.log('MapDevicePopup: Invalid device data', device);
    }
    return null;
  }

  const speedKmh = Math.round((position.speed || 0) * 1.852);
  const distanceKm = position.totalDistance ? Math.round(position.totalDistance / 1000) : 0;
  const fuelLevel = position.attributes?.fuelLevel ?? position.attributes?.fuel ?? device.attributes?.fuelLevel;

  return (
    <Box
      ref={popupRef}
      className={classes.popup}
      style={{
        left: popupPosition.x,
        top: popupPosition.y,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Drag Handle */}
      <Box 
        className={classes.dragHandle}
        onMouseDown={handleDragStart}
      />
      
      {/* Header */}
      <Box className={classes.header}>
        <Box className={classes.deviceInfo}>
          {getDeviceIcon(device.attributes?.deviceType)}
          <Typography className={classes.deviceName}>
            {device.name}
          </Typography>
          <Chip
            label="Live"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.64rem',
              fontWeight: 700,
              borderRadius: 999,
              backgroundColor: 'rgba(34, 197, 94, 0.14)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.25)',
            }}
          />
          <Box 
            className={`${classes.statusDot} ${getStatusClass(device.status)}`}
          />
        </Box>
        
        <IconButton 
          size="small" 
          onClick={onClose}
          sx={{ p: 0.5 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box className={classes.content}>
        <Box className={classes.metricsGrid}>
          <Box className={classes.metricCard}>
            <Typography className={classes.metricLabel}>Updated</Typography>
            <Typography className={classes.metricValue}>{getTimeAgo(position.fixTime)}</Typography>
          </Box>
          <Box className={classes.metricCard}>
            <Typography className={classes.metricLabel}>Speed</Typography>
            <Typography className={classes.metricValue}>{speedKmh} km/h</Typography>
          </Box>
          <Box className={classes.metricCard}>
            <Typography className={classes.metricLabel}>Distance</Typography>
            <Typography className={classes.metricValue}>{distanceKm} km</Typography>
          </Box>
        </Box>

        {/* Expanded Content */}
        <Collapse in={isExpanded}>
          <Box className={classes.expandedContent}>
            <Box className={classes.detailRow}>
              <span className={classes.infoIcon}>📌</span>
              <Typography className={classes.infoText}>
                {position.address || 'Address not available'}
              </Typography>
            </Box>
            
            <Box className={classes.detailRow}>
              <span className={classes.infoIcon}>⛽</span>
              <Typography className={classes.infoText}>
                {Number.isFinite(Number(fuelLevel)) ? `${Math.round(Number(fuelLevel))}% Fuel` : 'Fuel data unavailable'}
              </Typography>
            </Box>

            <Box className={classes.detailRow}>
              <span className={classes.infoIcon}>🧭</span>
              <Typography className={classes.infoText}>
                {position.latitude?.toFixed?.(5)}, {position.longitude?.toFixed?.(5)}
              </Typography>
            </Box>
          </Box>
        </Collapse>

        {/* Quick Actions */}
        <Box className={classes.actions}>
          <Tooltip title="Focus on Map">
            <Button
              className={classes.actionButton}
              onClick={handleFocusOnMap}
              startIcon={<MyLocationIcon fontSize="small" />}
            >
              Focus
            </Button>
          </Tooltip>
          
          <Tooltip title="Live Tracking">
            <Button
              className={classes.actionButton}
              onClick={handleStartTracking}
              startIcon={<PlayArrowIcon fontSize="small" />}
            >
              Replay
            </Button>
          </Tooltip>
          
          <Tooltip title="Device Stats">
            <Button
              className={classes.actionButton}
              onClick={handleShowStats}
              startIcon={<BarChartIcon fontSize="small" />}
            >
              Details
            </Button>
          </Tooltip>
        </Box>

        {/* Expand/Collapse Button */}
        <Button
          className={classes.expandButton}
          onClick={() => setIsExpanded(!isExpanded)}
          endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          {isExpanded ? 'Less Details' : 'Full Details'}
        </Button>
      </Box>

      {/* Resize Handle */}
      <Box className={classes.resizeHandle} />
    </Box>
  );
};

export default MapDevicePopup;
