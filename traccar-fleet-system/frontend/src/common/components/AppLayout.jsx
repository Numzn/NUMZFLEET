import { Box, Drawer, IconButton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import GlobalSearch from './GlobalSearch';
import NotificationsDropdown from './NotificationsDropdown';
import UserMenuDropdown from './UserMenuDropdown';
import LogoImage from '../../login/LogoImage';
import ModernSidebar from './ModernSidebar';
import { 
  UnifiedTopbar, 
  TopbarLeftSection, 
  TopbarCenterSection, 
  TopbarRightSection,
  TopbarDivider 
} from './topbar';

const DRAWER_WIDTH = 280;
const TOP_OFFSET_DESKTOP = 'calc(env(safe-area-inset-top, 0px) + 56px)';
const TOP_OFFSET_TABLET = 'calc(env(safe-area-inset-top, 0px) + 56px)';
const TOP_OFFSET_MOBILE = 'calc(env(safe-area-inset-top, 0px) + 50px)';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    // Use svh for stable mobile viewport height (avoids jitter when browser bars show/hide)
    minHeight: '100svh',
    height: '100svh',
    overflow: 'hidden',
  },
  drawer: {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      width: DRAWER_WIDTH,
      boxSizing: 'border-box',
      top: TOP_OFFSET_DESKTOP,
      height: `calc(100svh - ${TOP_OFFSET_DESKTOP})`,
      borderRight: `1px solid ${theme.palette.divider}`,
      borderRadius: 0,
      backgroundColor: theme.palette.background.paper,
      zIndex: theme.zIndex.drawer,
      // Subtle gradient for depth
      backgroundImage: 'linear-gradient(to bottom, rgba(6, 182, 212, 0.01) 0%, transparent 100%)',
      [theme.breakpoints.between('md', 'lg')]: {
        top: TOP_OFFSET_TABLET,
        height: `calc(100svh - ${TOP_OFFSET_TABLET})`,
      },
      [theme.breakpoints.down('md')]: {
        top: TOP_OFFSET_MOBILE,
        height: `calc(100svh - ${TOP_OFFSET_MOBILE})`,
      },
    },
  },
  mobileMenuButton: {
    marginRight: theme.spacing(2),
  },
  content: {
    position: 'absolute',
    top: TOP_OFFSET_DESKTOP,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    boxSizing: 'border-box',
    backgroundColor: 'transparent',
    [theme.breakpoints.between('md', 'lg')]: {
      top: TOP_OFFSET_TABLET,
    },
    [theme.breakpoints.down('md')]: {
      left: 0,  // Full width on mobile when sidebar is hidden
      top: TOP_OFFSET_MOBILE,
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
    },
  },
}));

const AppLayout = ({ children, showSidebar = true }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [sidebarOpen, setSidebarOpen] = useState(desktop);

  return (
    <Box className={classes.root}>
      {/* Use unified topbar */}
      <UnifiedTopbar variant="appbar" position="fixed">
        <TopbarLeftSection>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <LogoImage
              color="#06b6d4"
              style={{ width: '48px', height: '48px', objectFit: 'contain' }}
            />
          </Box>
          
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

      {/* Left Sidebar - Below TopBar */}
      {showSidebar && (
        <Drawer
          variant={desktop ? 'permanent' : 'temporary'}
          open={desktop || sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          className={classes.drawer}
        >
          {/* Navigation Menu */}
          <ModernSidebar />
        </Drawer>
      )}

      {/* Right Side Container */}
      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',  // Add: Establishes positioning context
      }}>

        {/* Main Content */}
        <Box component="main" className={classes.content}>
          {children}
        </Box>


      </Box>
    </Box>
  );
};

export default AppLayout;





