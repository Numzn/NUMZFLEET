import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MenuIcon from '@mui/icons-material/Menu';
import { useSelector } from 'react-redux';
import FleetOperationalPills from '../fleet/FleetOperationalPills';
import NotificationCenter from '../../notifications/NotificationCenter';
import UserMenuDropdown from '../../common/components/UserMenuDropdown';
import { TOPBAR_HEIGHT } from '../../common/styles/topbarStyles';

const BAR_SX = {
  flexShrink: 0,
  width: '100%',
  height: TOPBAR_HEIGHT,
  minHeight: TOPBAR_HEIGHT,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  px: 'var(--space-6)',
  bgcolor: 'var(--surface-card)',
  borderBottom: '1px solid var(--surface-border)',
  boxShadow: 'none',
  backgroundImage: 'none',
};

const connectionPulse = {
  '@keyframes liveMapPulse': {
    '0%': { boxShadow: '0 0 0 0 rgba(5, 150, 105, 0.45)' },
    '70%': { boxShadow: '0 0 0 6px rgba(5, 150, 105, 0)' },
    '100%': { boxShadow: '0 0 0 0 rgba(5, 150, 105, 0)' },
  },
};

const FleetLiveIdentity = ({ socketConnected }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
    <Typography
      component="span"
      noWrap
      sx={{
        fontWeight: 700,
        fontSize: '12px',
        lineHeight: 1.2,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--text-on-surface-primary)',
      }}
    >
      FLEET · LIVE
    </Typography>
    <Tooltip
      title={socketConnected ? 'Live feed connected' : 'Live feed disconnected — reconnecting…'}
      arrow
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: socketConnected ? 'var(--color-success)' : 'var(--color-critical)',
          animation: socketConnected ? 'liveMapPulse 2s infinite' : 'none',
        }}
      />
    </Tooltip>
  </Box>
);

const LiveMapTopBar = ({
  desktop = true,
  fleetCollapsed = false,
  onToggleFleetCollapse,
  effectiveFleetTab = 'all',
  operationalPresence = {
    hasMoving: false,
    hasIdle: false,
    hasOffline: false,
    hasAlerts: false,
  },
  showAppNavMenuButton = false,
  onOpenAppNavMenu,
  showMobileFleetDrawerButton = false,
  onOpenMobileFleetDrawer,
}) => {
  const socketConnected = useSelector((state) => !!state.session.socket);

  return (
    <Box
      component="header"
      role="banner"
      aria-label="Fleet live operations"
      sx={{
        ...BAR_SX,
        ...connectionPulse,
        px: { xs: 'var(--space-4)', md: 'var(--space-6)' },
        pt: { xs: 'env(safe-area-inset-top, 0px)', md: 0 },
        height: {
          xs: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_HEIGHT}px)`,
          md: TOPBAR_HEIGHT,
        },
        minHeight: {
          xs: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_HEIGHT}px)`,
          md: TOPBAR_HEIGHT,
        },
      }}
    >
      {/* Identity + rail control */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        {showAppNavMenuButton && (
          <Tooltip title="App menu">
            <IconButton
              size="small"
              onClick={() => onOpenAppNavMenu?.()}
              aria-label="Open app menu"
              sx={{
                color: 'var(--text-on-surface-secondary)',
                '&:hover': { bgcolor: 'var(--surface-card-hover)' },
              }}
            >
              <MenuIcon sx={{ fontSize: '1.15rem' }} />
            </IconButton>
          </Tooltip>
        )}
        {showMobileFleetDrawerButton && (
          <Tooltip title="Fleet list">
            <IconButton
              size="small"
              onClick={() => onOpenMobileFleetDrawer?.()}
              aria-label="Open fleet list"
              sx={{
                color: 'var(--text-on-surface-secondary)',
                '&:hover': { bgcolor: 'var(--surface-card-hover)' },
              }}
            >
              <ListAltIcon sx={{ fontSize: '1.15rem' }} />
            </IconButton>
          </Tooltip>
        )}

        {(!desktop || !fleetCollapsed) && (
          <FleetLiveIdentity socketConnected={socketConnected} />
        )}

        {desktop && (
          <Tooltip title={fleetCollapsed ? 'Expand fleet panel' : 'Collapse fleet panel'}>
            <IconButton
              size="small"
              onClick={() => onToggleFleetCollapse?.()}
              aria-label={fleetCollapsed ? 'Expand fleet panel' : 'Collapse fleet panel'}
              sx={{
                color: 'var(--text-on-surface-secondary)',
                '&:hover': { bgcolor: 'var(--surface-card-hover)' },
              }}
            >
              {fleetCollapsed ? (
                <ChevronRightIcon sx={{ fontSize: '1.1rem' }} />
              ) : (
                <ChevronLeftIcon sx={{ fontSize: '1.1rem' }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Operational filters — grows into open space */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          justifyContent: { xs: 'flex-end', md: 'flex-start' },
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            overflowX: 'auto',
            minWidth: 0,
            maxWidth: '100%',
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          <FleetOperationalPills
            fleetTab={effectiveFleetTab}
            presence={operationalPresence}
          />
        </Box>
      </Box>

      {/* Account chrome */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          flexShrink: 0,
        }}
      >
        <NotificationCenter />
        <UserMenuDropdown />
      </Box>
    </Box>
  );
};

export default LiveMapTopBar;
