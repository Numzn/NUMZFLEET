import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ListAltIcon from '@mui/icons-material/ListAlt';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import FleetOperationalPills from '../fleet/FleetOperationalPills';
import NotificationCenter from '../../notifications/NotificationCenter';
import UserMenuDropdown from '../../common/components/UserMenuDropdown';
import { TOPBAR_HEIGHT } from '../../common/styles/topbarStyles';

/**
 * Single operational command surface for `/map`.
 * Left: FLEET · LIVE + feed connection dot + rail collapse (desktop).
 * Center: FleetOperationalPills. Right: dashboard (desktop), notifications, user.
 * Surfaces: --surface-card / --surface-border only (no gradient/cyan chrome).
 */

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

const connectionKeyframes = {
  '@keyframes liveMapPulseRing': {
    '0%': {
      transform: 'scale(0.95)',
      opacity: 0.85,
      boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.5)',
    },
    '70%': {
      transform: 'scale(1.12)',
      opacity: 0.4,
      boxShadow: '0 0 0 6px rgba(16, 185, 129, 0)',
    },
    '100%': {
      transform: 'scale(0.95)',
      opacity: 0.85,
      boxShadow: '0 0 0 0 rgba(16, 185, 129, 0)',
    },
  },
  '@keyframes liveMapDisconnectedBlink': {
    '0%, 100%': { opacity: 1, transform: 'scale(1)' },
    '50%': { opacity: 0.5, transform: 'scale(0.95)' },
  },
};

const ConnectionIndicator = ({ socketConnected }) => (
  <Tooltip
    title={socketConnected ? 'Live feed connected' : 'Live feed disconnected — reconnecting…'}
    arrow
  >
    <Box
      role="status"
      aria-live="polite"
      aria-label={socketConnected ? 'Live feed connected' : 'Live feed disconnected'}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '1.5px solid',
          borderColor: socketConnected ? 'var(--color-success)' : 'var(--color-critical)',
          bgcolor: socketConnected ? 'rgba(5, 150, 105, 0.14)' : 'rgba(220, 38, 38, 0.12)',
          animation: socketConnected
            ? 'liveMapPulseRing 2s ease-out infinite'
            : 'liveMapDisconnectedBlink 1.2s ease-in-out infinite',
        }}
      />
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          zIndex: 1,
          bgcolor: socketConnected ? 'var(--color-success)' : 'var(--color-critical)',
          boxShadow: socketConnected
            ? '0 0 6px rgba(5, 150, 105, 0.6)'
            : '0 0 5px rgba(220, 38, 38, 0.55)',
        }}
      />
    </Box>
  </Tooltip>
);

const pillsScrollSx = {
  overflowX: 'auto',
  overflowY: 'hidden',
  minWidth: 0,
  maxWidth: '100%',
  maxHeight: '100%',
  WebkitOverflowScrolling: 'touch',
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
};

const FleetLiveIdentity = ({ socketConnected, compact = false }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexShrink: 0 }}>
    {!compact && (
      <Typography
        component="span"
        noWrap
        sx={{
          fontWeight: 700,
          fontSize: { xs: '10px', sm: '12px' },
          lineHeight: 1.2,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-on-surface-primary)',
        }}
      >
        FLEET · LIVE
      </Typography>
    )}
    <ConnectionIndicator socketConnected={socketConnected} />
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
  const navigate = useNavigate();
  const socketConnected = useSelector((state) => !!state.session.socket);
  const compactIdentity = !desktop && showAppNavMenuButton && showMobileFleetDrawerButton;

  return (
    <Box
      component="header"
      role="banner"
      aria-label="Fleet live operations"
      sx={{
        ...BAR_SX,
        ...connectionKeyframes,
        gap: { xs: 'var(--space-2)', md: 'var(--space-3)' },
        px: { xs: 'var(--space-3)', sm: 'var(--space-4)', md: 'var(--space-6)' },
        pt: 'env(safe-area-inset-top, 0px)',
        height: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_HEIGHT}px)`,
        minHeight: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_HEIGHT}px)`,
      }}
    >
      {/* Identity + rail / drawer controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.25, sm: 'var(--space-1)' },
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
          <FleetLiveIdentity socketConnected={socketConnected} compact={compactIdentity} />
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

      {/* Operational filters — single horizontal scroll row; no vertical wrap */}
      <Box
        sx={{
          ...pillsScrollSx,
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          justifyContent: 'flex-start',
        }}
      >
        <FleetOperationalPills
          fleetTab={effectiveFleetTab}
          presence={operationalPresence}
        />
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
        <Tooltip title="Fleet dashboard">
          <IconButton
            size="small"
            onClick={() => navigate('/')}
            aria-label="Back to fleet dashboard"
            sx={{
              color: 'var(--text-on-surface-secondary)',
              '&:hover': { bgcolor: 'var(--surface-card-hover)' },
            }}
          >
            <DashboardOutlinedIcon sx={{ fontSize: '1.2rem' }} />
          </IconButton>
        </Tooltip>
        <NotificationCenter />
        <UserMenuDropdown />
      </Box>
    </Box>
  );
};

export default LiveMapTopBar;
