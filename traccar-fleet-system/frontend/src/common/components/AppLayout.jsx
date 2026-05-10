import { Box, Drawer, IconButton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import GlobalSearch from './GlobalSearch';
import NotificationsDropdown from './NotificationsDropdown';
import UserMenuDropdown from './UserMenuDropdown';
import ModernSidebar from './ModernSidebar';
import BottomMenu from './BottomMenu';
import usePersistedState from '../util/usePersistedState';
import {
  UnifiedTopbar,
  TopbarLeftSection,
  TopbarCenterSection,
  TopbarRightSection,
  TopbarDivider,
} from './topbar';

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

const AppLayout = ({ children, showSidebar = true }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [sidebarOpen, setSidebarOpen] = useState(desktop);
  const [collapsed, setCollapsed] = usePersistedState('sidebarCollapsed', false);
  const topbarRef = useRef(null);
  const bottomNavRef = useRef(null);
  const [topbarHeight, setTopbarHeight] = useState(56);
  const [bottomNavHeight, setBottomNavHeight] = useState(0);

  const handleSidebarNavigate = useCallback(() => {
    if (!desktop) {
      setSidebarOpen(false);
    }
  }, [desktop]);

  const drawerWidth = desktop
    ? (collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED)
    : { xs: '80vw', sm: 360 };

  // Bottom nav is shown at all breakpoints; keep scrollable main content above it.
  const mainPaddingBottom = useMemo(() => {
    const safeBottom = 'env(safe-area-inset-bottom, 0px)';
    return `calc(${safeBottom} + ${bottomNavHeight}px + ${CHROME_GAP}px)`;
  }, [bottomNavHeight]);

  useLayoutEffect(() => {
    const read = () => {
      const tb = topbarRef.current?.getBoundingClientRect?.().height;
      const paper = bottomNavRef.current?.querySelector?.('.MuiPaper-root');
      const bn = paper?.getBoundingClientRect?.().height
        ?? bottomNavRef.current?.getBoundingClientRect?.().height
        ?? 0;
      if (tb && Math.abs(tb - topbarHeight) > 0.5) setTopbarHeight(tb);
      if (bn != null && Math.abs(bn - bottomNavHeight) > 0.5) setBottomNavHeight(bn);
      // Expose for MapChromePadding + any full-bleed surfaces.
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--app-topbar-height', `${tb || topbarHeight}px`);
        document.documentElement.style.setProperty('--app-bottomnav-height', `${bn || 0}px`);
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
  }, [bottomNavHeight, topbarHeight]);

  const embeddedTopbarSx = {
    width: '100%',
    flexShrink: 0,
    left: 'auto',
    right: 'auto',
    top: 'auto',
    borderRadius: 0,
    boxShadow: 'none',
    border: 'none',
    borderBottom: `1px solid ${theme.palette.divider}`,
    zIndex: theme.zIndex.appBar,
  };

  return (
    <Box className={classes.root}>
      {showSidebar && (
        <Drawer
          variant={desktop ? 'permanent' : 'temporary'}
          open={desktop || sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          className={classes.drawer}
          ModalProps={{ keepMounted: true }}
          sx={{
            width: desktop ? drawerWidth : 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              maxWidth: desktop ? undefined : 420,
            },
          }}
        >
          <ModernSidebar
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            forceExpanded={!desktop}
            showHeaderLogo={desktop}
            onNavigate={handleSidebarNavigate}
          />
        </Drawer>
      )}

      <Box className={classes.mainColumn}>
        <UnifiedTopbar ref={topbarRef} variant="appbar" position="static" sx={embeddedTopbarSx}>
          <TopbarLeftSection>
            {!desktop && (
              <IconButton
                onClick={() => setSidebarOpen(true)}
                edge="start"
                size="small"
                sx={{
                  padding: '6px',
                  '&:hover': {
                    backgroundColor: 'rgba(6, 182, 212, 0.08)',
                  },
                }}
              >
                <MenuIcon sx={{ fontSize: '1.1rem' }} />
              </IconButton>
            )}
          </TopbarLeftSection>

          <TopbarCenterSection>
            <GlobalSearch />
          </TopbarCenterSection>

          <TopbarDivider />

          <TopbarRightSection>
            <NotificationsDropdown />
            <UserMenuDropdown />
          </TopbarRightSection>
        </UnifiedTopbar>

        <Box component="main" className={classes.main} sx={{ pb: mainPaddingBottom }}>
          {children}
        </Box>

        <Box
          ref={bottomNavRef}
          sx={{
            '@media print': { display: 'none' },
          }}
        >
          <BottomMenu />
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;
