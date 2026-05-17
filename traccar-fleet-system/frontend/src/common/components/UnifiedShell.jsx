import { Box, Drawer, IconButton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import {
  useCallback, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import MenuIcon from '@mui/icons-material/Menu';
import UnifiedSidebar from './UnifiedSidebar';
import FleetWorkspaceTabs from './FleetWorkspaceTabs';
import PremiumTopBar from '../../main/components/PremiumTopBar';
import FleetSidebar from '../../main/fleet/FleetSidebar';
import usePersistedState from '../util/usePersistedState';
import { getWorkspaceType } from '../util/workspaceTypes';
import {
  FLEET_SIDEBAR_RAIL_WIDTH_PX,
  FLEET_SIDEBAR_WIDTH_PX,
} from '../../main/fleet/fleetLayoutConstants';
import { LiveMapChromeProvider, useLiveMapChrome } from '../../main/fleet/LiveMapChromeContext';

const DRAWER_WIDTH_EXPANDED = 168;
const DRAWER_WIDTH_COLLAPSED = 68;
const CHROME_GAP = 8;

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: '100svh',
    height: '100svh',
    overflow: 'hidden',
  },
  drawer: {
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      boxSizing: 'border-box',
      position: 'relative',
      top: 0,
      height: '100%',
      maxHeight: '100svh',
      borderRight: `1px solid ${theme.palette.divider}`,
      borderRadius: 0,
      backgroundColor: theme.palette.background.paper,
      backgroundImage: 'linear-gradient(to bottom, rgba(6, 182, 212, 0.01) 0%, transparent 100%)',
      overflowX: 'hidden',
    },
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    boxSizing: 'border-box',
  },
}));

function UnifiedShellContent() {
  const { classes } = useStyles();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const workspaceType = getWorkspaceType(location.pathname);
  const isLive = workspaceType === 'live';
  const isFullscreen = workspaceType === 'fullscreen';

  const { chrome } = useLiveMapChrome();
  const fleetSidebarCollapsed = useSelector((s) => s.fleetInteraction.sidebarCollapsed);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appNavOpen, setAppNavOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersistedState('sidebarCollapsed', false);
  const topbarRef = useRef(null);
  const [topbarHeight, setTopbarHeight] = useState(56);

  const handleSidebarNavigate = useCallback(() => {
    if (!desktop) {
      setSidebarOpen(false);
      setAppNavOpen(false);
    }
  }, [desktop]);

  const appDrawerWidth = desktop
    ? (collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED)
    : { xs: '80vw', sm: 360 };

  const liveDrawerWidth = desktop
    ? (fleetSidebarCollapsed ? FLEET_SIDEBAR_RAIL_WIDTH_PX : FLEET_SIDEBAR_WIDTH_PX)
    : 0;

  const mainPaddingBottom = useMemo(() => {
    const safeBottom = 'env(safe-area-inset-bottom, 0px)';
    return `calc(${safeBottom} + ${CHROME_GAP}px)`;
  }, []);

  useLayoutEffect(() => {
    const read = () => {
      const tb = topbarRef.current?.getBoundingClientRect?.().height;
      if (tb && Math.abs(tb - topbarHeight) > 0.5) setTopbarHeight(tb);
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--app-topbar-height', `${tb ?? 0}px`);
        document.documentElement.style.setProperty('--app-bottomnav-height', '0px');
      }
    };
    read();
    window.addEventListener('resize', read);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', read);
    return () => {
      window.removeEventListener('resize', read);
      vv?.removeEventListener('resize', read);
    };
  }, [topbarHeight]);

  const showDefaultNavDrawer = !isLive && !isFullscreen;
  const showLiveFleetPermanentDrawer = isLive && desktop;

  const showDefaultPermanentNav = showDefaultNavDrawer && desktop;
  const showDefaultTemporaryNav = showDefaultNavDrawer && !desktop;

  const renderAppSidebar = () => (
    <UnifiedSidebar
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      forceExpanded={!desktop}
      showHeaderLogo={desktop}
      onNavigate={handleSidebarNavigate}
    />
  );

  const renderLiveFleetSidebar = () => {
    if (!chrome?.sidebarFleetProps) {
      return <Box sx={{ width: '100%', p: 1 }} />;
    }
    return (
      <FleetSidebar
        {...chrome.sidebarFleetProps}
        collapsed={fleetSidebarCollapsed}
        variant="desktop"
      />
    );
  };

  return (
    <Box className={classes.root}>
      {showLiveFleetPermanentDrawer && (
        <Drawer
          variant="permanent"
          open
          className={classes.drawer}
          sx={{
            width: liveDrawerWidth,
            '& .MuiDrawer-paper': {
              width: liveDrawerWidth,
              overflow: 'hidden',
            },
          }}
        >
          {renderLiveFleetSidebar()}
        </Drawer>
      )}

      {showDefaultPermanentNav && (
        <Drawer
          variant="permanent"
          open
          onClose={() => setSidebarOpen(false)}
          className={classes.drawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            width: appDrawerWidth,
            '& .MuiDrawer-paper': {
              width: appDrawerWidth,
              maxWidth: desktop ? undefined : 420,
            },
          }}
        >
          {renderAppSidebar()}
        </Drawer>
      )}

      {showDefaultTemporaryNav && (
        <Drawer
          variant="temporary"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          className={classes.drawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            width: 0,
            '& .MuiDrawer-paper': {
              width: appDrawerWidth,
              maxWidth: 420,
            },
          }}
        >
          {renderAppSidebar()}
        </Drawer>
      )}

      {isLive && !desktop && (
        <Drawer
          variant="temporary"
          anchor="left"
          open={appNavOpen}
          onClose={() => setAppNavOpen(false)}
          className={classes.drawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: '80vw', sm: 360 },
              maxWidth: 420,
            },
          }}
        >
          {renderAppSidebar()}
        </Drawer>
      )}

      {isFullscreen && (
        <Drawer
          variant="temporary"
          anchor="left"
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          className={classes.drawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: { xs: '80vw', sm: 360 },
              maxWidth: 420,
            },
          }}
        >
          {renderAppSidebar()}
        </Drawer>
      )}

      <Box className={classes.mainColumn}>
        <Box ref={topbarRef} sx={{ flexShrink: 0, pt: isFullscreen ? 'env(safe-area-inset-top, 0px)' : 0 }}>
          {workspaceType === 'default' && !desktop && (
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
              <IconButton edge="start" size="small" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <MenuIcon />
              </IconButton>
            </Box>
          )}

          {workspaceType === 'default' && <FleetWorkspaceTabs />}

          {isLive && chrome?.topBarProps && (
            <PremiumTopBar
              embedded
              {...chrome.topBarProps}
              showAppNavMenuButton={!desktop}
              onOpenAppNavMenu={() => setAppNavOpen(true)}
            />
          )}

          {isFullscreen && (
            <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, py: 0.25, borderBottom: 1, borderColor: 'divider' }}>
              <IconButton edge="start" size="small" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <MenuIcon />
              </IconButton>
            </Box>
          )}
        </Box>

        <Box component="main" className={classes.main} sx={{ pb: mainPaddingBottom }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

const UnifiedShell = () => (
  <LiveMapChromeProvider>
    <UnifiedShellContent />
  </LiveMapChromeProvider>
);

export default UnifiedShell;
