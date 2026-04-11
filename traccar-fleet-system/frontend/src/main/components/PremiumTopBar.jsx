import React, { useState, useCallback } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Box, 
  Typography, 
  IconButton, 
  Tooltip,
  useTheme,
  useMediaQuery,
  Fade
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useSelector } from 'react-redux';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoImage from '../../login/LogoImage';
import DeviceStatsChips from './DeviceStatsChips';
import SearchWithDropdown from './SearchWithDropdown';
import FiltersFlyout from './FiltersFlyout';
import NotificationsDropdown from '../../common/components/NotificationsDropdown';
import UserMenuDropdown from '../../common/components/UserMenuDropdown';

const useStyles = makeStyles()((theme) => ({
  premiumAppBar: {
    height: 64,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: 'linear-gradient(180deg, rgba(6, 182, 212, 0.02) 0%, transparent 100%)',
    borderBottom: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: theme.zIndex.appBar,
    borderRadius: 0,
    width: '100vw',
  },
  toolbar: {
    minHeight: 64,
    height: 64,
    padding: theme.spacing(0, 3),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  brandSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    minWidth: '200px',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    overflow: 'hidden',
    padding: 0,
    margin: 0,
  },
  brandTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '0.3px',
  },
  centerSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flex: 1,
    justifyContent: 'center',
    maxWidth: '800px',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: '120px',
    justifyContent: 'flex-end',
  },
  divider: {
    height: '24px',
    width: '1px',
    backgroundColor: theme.palette.divider,
    margin: theme.spacing(0, 1),
  },
  // Mobile responsive styles
  mobileToolbar: {
    padding: theme.spacing(0, 2),
    gap: theme.spacing(1),
  },
  mobileBrandSection: {
    minWidth: 'auto',
    gap: theme.spacing(1),
  },
  mobileCenterSection: {
    flex: 1,
    justifyContent: 'flex-start',
    maxWidth: 'none',
  },
  mobileRightSection: {
    minWidth: 'auto',
    gap: theme.spacing(0.5),
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background-color 0.4s ease',
  },
  '@keyframes pulse': {
    '0%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0.5)' },
    '70%': { boxShadow: '0 0 0 6px rgba(34, 197, 94, 0)' },
    '100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0)' },
  },
}));

const PremiumTopBar = ({ 
  devices = [], 
  stats = {}, 
  onSearch, 
  onFilterChange,
  onNavigateToDashboard,
  onShowAllDevices,
  groups = [],
  filters = { statuses: [], groups: [], sortBy: '', mapOnly: false }
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const socketConnected = useSelector((state) => !!state.session.socket);
  
  // Responsive breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  
  // State for animations and interactions
  const [isScrolled, setIsScrolled] = useState(false);
  const [showStats, setShowStats] = useState(!isMobile);

  // Handle scroll for dynamic styling
  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset;
    setIsScrolled(scrollTop > 10);
  }, []);

  React.useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Calculate responsive height
  const getToolbarHeight = () => {
    if (isMobile) return 56;
    if (isTablet) return 60;
    return 64;
  };

  const toolbarHeight = getToolbarHeight();

  return (
    <AppBar 
      position="fixed" 
      className={classes.premiumAppBar}
      sx={{
        height: toolbarHeight,
      }}
    >
      <Toolbar 
        className={`${classes.toolbar} ${isMobile ? classes.mobileToolbar : ''}`}
        sx={{ minHeight: toolbarHeight, height: toolbarHeight }}
      >
        {/* Left Section - Brand */}
        <Box 
          className={`${classes.brandSection} ${isMobile ? classes.mobileBrandSection : ''}`}
        >
          <Box className={classes.logoContainer}>
            <LogoImage 
              color="#06b6d4" 
              style={{ 
                width: isMobile ? '40px' : '48px', 
                height: isMobile ? '40px' : '48px',
                maxWidth: isMobile ? '40px' : '48px',
                maxHeight: isMobile ? '40px' : '48px',
                objectFit: 'contain',
                margin: 0
              }} 
            />
          </Box>
          <Typography 
            className={classes.brandTitle}
            sx={{ 
              fontSize: isMobile ? '1.1rem' : '1.25rem',
              display: { xs: 'none', sm: 'block' }
            }}
          >
            Live Map
          </Typography>
          {/* Connection status indicator */}
          <Tooltip title={socketConnected ? 'Backend connected' : 'Backend disconnected — reconnecting…'} arrow>
            <Box
              className={classes.connectionDot}
              sx={{
                backgroundColor: socketConnected ? '#22c55e' : '#ef4444',
                animation: socketConnected ? 'pulse 2s infinite' : 'none',
                ml: 0.5,
              }}
            />
          </Tooltip>
        </Box>

        {/* Center Section - Stats & Search */}
        <Box 
          className={`${classes.centerSection} ${isMobile ? classes.mobileCenterSection : ''}`}
        >
          {/* Device Stats Chips - Hidden on mobile, shown in hamburger menu */}
          <Fade in={showStats && !isMobile} timeout={300}>
            <Box>
              <DeviceStatsChips 
                stats={stats}
                onFilterClick={onFilterChange}
                compact={isTablet}
              />
            </Box>
          </Fade>

          {/* Search with Dropdown */}
          <SearchWithDropdown 
            devices={devices}
            onSearch={onSearch}
            onShowAllDevices={onShowAllDevices}
            compact={isMobile}
            expanded={!isMobile}
          />
        </Box>

        {/* Right Section - Actions */}
        <Box 
          className={`${classes.rightSection} ${isMobile ? classes.mobileRightSection : ''}`}
        >
          {/* Dashboard Navigation - Hidden on mobile */}
          <IconButton
            onClick={onNavigateToDashboard}
            size="small"
            sx={{
              display: { xs: 'none', md: 'flex' },
              padding: '8px',
              backgroundColor: 'rgba(6, 182, 212, 0.08)',
              '&:hover': {
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                transform: 'scale(1.05)',
              },
            }}
            title="Back to Dashboard"
          >
            <DashboardIcon sx={{ fontSize: '1.2rem' }} />
          </IconButton>

          {/* Visual Divider - Hidden on mobile */}
          <Box 
            className={classes.divider}
            sx={{ display: { xs: 'none', md: 'block' } }}
          />

          {/* Filters Flyout */}
          <FiltersFlyout 
            onFilterChange={onFilterChange}
            compact={isMobile}
            groups={groups}
            filters={filters}
            devices={devices}
          />

          {/* Notifications */}
          <NotificationsDropdown />

          {/* User Menu */}
          <UserMenuDropdown />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default PremiumTopBar;
