import {
  Box, Drawer, IconButton, Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import {
  useCallback, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import MenuIcon from '@mui/icons-material/Menu';
import UnifiedSidebar from './UnifiedSidebar';
import ContextSelector from '../../saas/components/ContextSelector';
import { TopBarTitleProvider, useTopBarTitle } from './TopBarTitleContext';
import LiveMapTopBar from '../../main/components/LiveMapTopBar';
import FleetSidebar from '../../main/fleet/FleetSidebar';
import usePersistedState, { savePersistedState } from '../util/usePersistedState';
import { getWorkspaceType } from '../util/workspaceTypes';
import { resolveShellChrome } from './shellChrome';
import { TOPBAR_HEIGHT } from '../styles/topbarStyles';
import {
  FLEET_SIDEBAR_RAIL_WIDTH_PX,
  FLEET_SIDEBAR_WIDTH_PX,
} from '../../main/fleet/fleetLayoutConstants';
import { LiveMapChromeProvider, useLiveMapChrome } from '../../main/fleet/LiveMapChromeContext';
import { fleetInteractionActions } from '../../store';
import { RUNTIME_WORKSPACE_PT, RUNTIME_WORKSPACE_PX } from '../styles/runtimeDensity';

const DRAWER_WIDTH_EXPANDED = 260;
const DRAWER_WIDTH_COLLAPSED = 72;
const CHROME_GAP = 8;

/** Paper size for the temporary nav drawer, on every surface that opens one. */
const TEMPORARY_NAV_WIDTH = { xs: '80vw', sm: 360 };
const TEMPORARY_NAV_MAX_WIDTH = 420;

const useStyles = makeStyles()(() => ({
  root: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: '100svh',
    height: '100svh',
    overflow: 'hidden',
  },
  rootLiveStacked: {
    flexDirection: 'column',
  },
  bodyRow: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  /** In-flow nav column — avoids MUI permanent Drawer double horizontal reservation */
  navRail: {
    flexShrink: 0,
    boxSizing: 'border-box',
    height: '100%',
    overflow: 'hidden',
    borderRight: '1px solid var(--surface-border)',
    backgroundColor: 'var(--surface-card)',
  },
  drawer: {
    '& .MuiDrawer-paper': {
      boxSizing: 'border-box',
      height: '100%',
      maxHeight: '100svh',
      borderRadius: 0,
      backgroundColor: 'var(--surface-card)',
      backgroundImage: 'none',
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
    backgroundColor: 'var(--surface-app)',
  },
}));

function UnifiedShellContent() {
  const { classes } = useStyles();
  const theme = useTheme();
  const dispatch = useDispatch();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const location = useLocation();
  const workspaceType = getWorkspaceType(location.pathname);
  // Dashboard is the index route ('/'); it renders full-bleed (no outer main gutter).
  const isDashboard = location.pathname === '/';
  const isLive = workspaceType === 'live';
  const isFullscreen = workspaceType === 'fullscreen';
  const { chrome } = useLiveMapChrome();
  const { title: topBarTitle } = useTopBarTitle();
  const fleetSidebarCollapsed = useSelector((s) => s.fleetInteraction.sidebarCollapsed);

  // One flag for the single temporary nav drawer. The default workspace, the
  // live map and fullscreen pages never show it at the same time, so they do
  // not need an open-state each.
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersistedState('sidebarCollapsed', false);
  const topbarRef = useRef(null);
  const [topbarHeight, setTopbarHeight] = useState(TOPBAR_HEIGHT);

  const handleSidebarNavigate = useCallback(() => {
    setNavDrawerOpen(false);
  }, []);

  const handleToggleFleetCollapse = useCallback(() => {
    const next = !fleetSidebarCollapsed;
    dispatch(fleetInteractionActions.setSidebarCollapsed(next));
    savePersistedState('fleetSidebarCollapsed', next);
  }, [dispatch, fleetSidebarCollapsed]);

  // Only read by the permanent desktop rail — the temporary drawer sizes itself.
  const appDrawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;

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
  }, [topbarHeight, isLive, desktop]);

  const {
    showPermanentNav: showDefaultPermanentNav,
    showTemporaryNav,
    showLiveFleetRail: showLiveFleetPermanentDrawer,
  } = resolveShellChrome({ workspaceType, desktop });

  const sidebarFleetProps = chrome?.sidebarFleetProps;

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
    if (!sidebarFleetProps) {
      return <Box sx={{ width: '100%', p: 1 }} />;
    }
    return (
      <FleetSidebar
        {...sidebarFleetProps}
        collapsed={fleetSidebarCollapsed}
        variant="desktop"
        hideHeader
        hideOperationalPills
      />
    );
  };

  const renderLiveMapTopBar = () => {
    if (!isLive || !sidebarFleetProps) return null;
    return (
      <LiveMapTopBar
        desktop={desktop}
        fleetCollapsed={fleetSidebarCollapsed}
        onToggleFleetCollapse={handleToggleFleetCollapse}
        effectiveFleetTab={sidebarFleetProps.effectiveFleetTab}
        operationalPresence={sidebarFleetProps.operationalPresence}
        showAppNavMenuButton={!desktop}
        onOpenAppNavMenu={() => setNavDrawerOpen(true)}
      />
    );
  };

  const renderDrawers = () => showTemporaryNav && (
    <Drawer
      variant="temporary"
      anchor="left"
      open={navDrawerOpen}
      onClose={() => setNavDrawerOpen(false)}
      className={classes.drawer}
      ModalProps={{ keepMounted: true }}
      sx={{
        '& .MuiDrawer-paper': {
          width: TEMPORARY_NAV_WIDTH,
          maxWidth: TEMPORARY_NAV_MAX_WIDTH,
        },
      }}
    >
      {renderAppSidebar()}
    </Drawer>
  );

  const renderNavRails = () => (
    <>
      {showLiveFleetPermanentDrawer && (
        <Box className={classes.navRail} sx={{ width: liveDrawerWidth }}>
          {renderLiveFleetSidebar()}
        </Box>
      )}

      {showDefaultPermanentNav && (
        <Box className={classes.navRail} sx={{ width: appDrawerWidth }}>
          {renderAppSidebar()}
        </Box>
      )}
    </>
  );

  const renderMainColumn = () => (
    <Box className={classes.mainColumn}>
      {!isLive && (
        <Box ref={topbarRef} sx={{ flexShrink: 0, pt: isFullscreen ? 'env(safe-area-inset-top, 0px)' : 0 }}>
          {workspaceType === 'default' && (!desktop || topBarTitle) && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                boxSizing: 'border-box',
                // Same height, background and border as the sidebar's own logo
                // strip (UnifiedSidebar.jsx) — the two used to be sized and
                // colored independently, so on desktop they read as two
                // unrelated bars stitched together instead of one shell.
                minHeight: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_HEIGHT}px)`,
                backgroundColor: 'var(--surface-card)',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              {!desktop && (
                <IconButton edge="start" size="small" onClick={() => setNavDrawerOpen(true)} aria-label="Open menu">
                  <MenuIcon />
                </IconButton>
              )}
              <ContextSelector />
              {topBarTitle && (
                <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flex: 1 }}>
                  {topBarTitle}
                </Typography>
              )}
            </Box>
          )}

          {isFullscreen && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 0.5,
                py: 0.25,
                backgroundColor: 'var(--surface-card)',
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <IconButton edge="start" size="small" onClick={() => setNavDrawerOpen(true)} aria-label="Open menu">
                <MenuIcon />
              </IconButton>
            </Box>
          )}
        </Box>
      )}

      <Box
        component="main"
        className={classes.main}
        sx={{
          // Dashboard supplies its own py/pb, and the live map is a full-bleed
          // canvas whose floating sheets handle their own safe-area insets —
          // shell stays at 0 for both to avoid a dead gap at the bottom.
          pb: (isDashboard || isLive) ? 0 : mainPaddingBottom,
          pt: workspaceType === 'default'
            ? (isDashboard ? 0 : RUNTIME_WORKSPACE_PT)
            : 0,
          px: workspaceType === 'default'
            ? (isDashboard ? 0 : RUNTIME_WORKSPACE_PX)
            : 0,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );

  if (isLive) {
    return (
      <Box className={`${classes.root} ${classes.rootLiveStacked}`}>
        <Box ref={topbarRef} sx={{ flexShrink: 0, width: '100%' }}>
          {renderLiveMapTopBar()}
        </Box>
        <Box className={classes.bodyRow}>
          {renderNavRails()}
          {renderDrawers()}
          {renderMainColumn()}
        </Box>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      {renderNavRails()}
      {renderDrawers()}
      {renderMainColumn()}
    </Box>
  );
}

const UnifiedShell = () => (
  <LiveMapChromeProvider>
    <TopBarTitleProvider>
      <UnifiedShellContent />
    </TopBarTitleProvider>
  </LiveMapChromeProvider>
);

export default UnifiedShell;
