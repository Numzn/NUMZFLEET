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
import MenuIcon from '@mui/icons-material/Menu';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LogoImage from '../../login/LogoImage';
import DeviceStatsChips from './DeviceStatsChips';
import SearchWithDropdown from './SearchWithDropdown';
import FiltersFlyout from './FiltersFlyout';
import NotificationCenter from '../../notifications/NotificationCenter';
import UserMenuDropdown from '../../common/components/UserMenuDropdown';

const useStyles = makeStyles()((theme) => ({
  premiumAppBar: {
    height: 56,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(5, 12, 24, 0.8)' : 'rgba(255, 255, 255, 0.82)',
    backgroundImage: theme.palette.mode === 'dark'
      ? 'linear-gradient(180deg, rgba(34, 211, 238, 0.08) 0%, rgba(0, 0, 0, 0) 100%)'
      : 'linear-gradient(180deg, rgba(6, 182, 212, 0.09) 0%, rgba(255, 255, 255, 0) 100%)',
    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(103, 232, 249, 0.18)' : 'rgba(15, 23, 42, 0.08)'}`,
    boxShadow: theme.palette.mode === 'dark'
      ? '0 10px 26px rgba(0, 0, 0, 0.34)'
      : '0 10px 24px rgba(7, 89, 133, 0.14)',
    backdropFilter: 'blur(14px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: theme.zIndex.appBar,
    borderRadius: 16,
    width: 'auto',
    overflow: 'hidden',
  },
  toolbar: {
    minHeight: 56,
    height: 56,
    padding: theme.spacing(0, 1.75),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1.15),
  },
  brandSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 'auto',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    overflow: 'hidden',
    padding: 0,
    margin: 0,
  },
  brandTitle: {
    fontSize: '1.05rem',
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
    gap: theme.spacing(1),
    flex: 1,
    justifyContent: 'center',
    maxWidth: 'none',
    minWidth: 0,
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 'auto',
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
    padding: theme.spacing(0, 1),
    gap: theme.spacing(1),
    justifyContent: 'flex-start',
  },
  mobileBrandSection: {
    minWidth: 0,
    flexShrink: 0,
    gap: theme.spacing(0.75),
  },
  mobileCenterSection: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 'none',
    minWidth: 0,
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
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
  filters = { statuses: [], groups: [], sortBy: '', mapOnly: false },
  /** When true (e.g. live map), square off the bottom on small screens so tiles meet the bar with no curved gap. */
  flatBottomOnMobile = false,
  /** Hide central search dropdown (fleet sidebar owns search). */
  hideCenterSearch = false,
  /** Mobile-only control to open fleet drawer */
  showMobileFleetDrawerButton = false,
  onOpenMobileFleetDrawer,
  /** Live map: hide stats + filters from top bar (sidebar owns operations). */
  mapRouteOperationalChrome = false,
  /** When true, bar sits in-flow under UnifiedShell instead of fixed to the viewport. */
  embedded = false,
  /** Mobile: open global app nav (UnifiedSidebar) */
  showAppNavMenuButton = false,
  onOpenAppNavMenu,
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
    if (isMobile) return 50;
    if (isTablet) return 56;
    return 56;
  };

  const toolbarHeight = getToolbarHeight();

  return (
    <AppBar 
      position={embedded ? 'relative' : 'fixed'}
      elevation={embedded ? 0 : undefined}
      className={classes.premiumAppBar}
      sx={{
        height: embedded ? `${toolbarHeight}px` : `calc(env(safe-area-inset-top, 0px) + ${toolbarHeight}px)`,
        paddingTop: embedded ? 0 : 'env(safe-area-inset-top, 0px)',
        top: embedded ? undefined : 0,
        left: embedded ? undefined : 0,
        right: embedded ? undefined : 0,
        width: embedded ? '100%' : undefined,
        borderRadius: embedded ? 0 : (flatBottomOnMobile && isMobile ? 0 : '0 0 14px 14px'),
        boxShadow: isScrolled
          ? (theme.palette.mode === 'dark'
            ? '0 16px 34px rgba(0, 0, 0, 0.4)'
            : '0 16px 34px rgba(7, 89, 133, 0.18)')
          : undefined,
      }}
    >
      <Toolbar 
        className={`${classes.toolbar} ${isMobile ? classes.mobileToolbar : ''}`}
        sx={{
          minHeight: `${toolbarHeight}px !important`,
          height: toolbarHeight,
          px: { xs: 1, sm: 1.35, md: 1.7 },
        }}
      >
        {/* Left Section - Brand */}
        <Box
          className={`${classes.brandSection} ${isMobile ? classes.mobileBrandSection : ''}`}
          sx={isMobile ? { pr: 0 } : undefined}
        >
          {showAppNavMenuButton && isMobile && (
            <Tooltip title="Menu">
              <IconButton
                edge="start"
                size="small"
                onClick={() => onOpenAppNavMenu?.()}
                sx={{ mr: 0.25 }}
              >
                <MenuIcon sx={{ fontSize: '1.15rem' }} />
              </IconButton>
            </Tooltip>
          )}
          {showMobileFleetDrawerButton && isMobile && (
            <Tooltip title="Fleet list">
              <IconButton
                edge="start"
                size="small"
                onClick={() => onOpenMobileFleetDrawer?.()}
                sx={{ mr: 0.25 }}
              >
                <ListAltIcon sx={{ fontSize: '1.15rem' }} />
              </IconButton>
            </Tooltip>
          )}
          {/* Match dashboard: hide below md via CSS so SSR/first paint never flashes the logo on phones */}
          <Box
            className={classes.logoContainer}
            sx={{ display: { xs: 'none', md: 'flex' } }}
          >
            <LogoImage 
              color="#06b6d4" 
              style={{ 
                width: '38px', 
                height: '38px',
                maxWidth: '38px',
                maxHeight: '38px',
                objectFit: 'contain',
                margin: 0
              }} 
            />
          </Box>
          <Typography
            className={classes.brandTitle}
            component="span"
            sx={{
              fontSize: isMobile ? '0.98rem' : '1.05rem',
              display: 'block',
              whiteSpace: 'nowrap',
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
              }}
            />
          </Tooltip>
        </Box>

        {/* Center Section - Stats & Search */}
        <Box 
          className={`${classes.centerSection} ${isMobile ? classes.mobileCenterSection : ''}`}
          sx={{
            gap: isMobile ? theme.spacing(0.75) : undefined,
          }}
        >
          {/* Device stats: omit on mobile so flex gap does not reserve empty space */}
          {!mapRouteOperationalChrome && !isMobile && (
            <Fade in={showStats} timeout={300}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <DeviceStatsChips
                  stats={stats}
                  onFilterClick={onFilterChange}
                  compact={isTablet}
                />
              </Box>
            </Fade>
          )}

          {!hideCenterSearch && (
            <SearchWithDropdown
              devices={devices}
              onSearch={onSearch}
              onShowAllDevices={onShowAllDevices}
              compact={isMobile}
              expanded={!isMobile}
            />
          )}
        </Box>

        {/* Right Section - Actions */}
        <Box 
          className={`${classes.rightSection} ${isMobile ? classes.mobileRightSection : ''}`}
          sx={isMobile ? { flexShrink: 0, ml: 'auto', pl: 0.5 } : undefined}
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
          {!mapRouteOperationalChrome && (
          <FiltersFlyout 
            onFilterChange={onFilterChange}
            compact={isMobile}
            groups={groups}
            filters={filters}
            devices={devices}
          />
          )}

          {/* Notifications */}
          <NotificationCenter />

          {/* User Menu */}
          <UserMenuDropdown />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default PremiumTopBar;
