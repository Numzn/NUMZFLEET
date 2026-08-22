import {
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu';
import { useSelector } from 'react-redux';
import FleetOperationalPills from '../fleet/FleetOperationalPills';
import NotificationCenter from '../../notifications/NotificationCenter';
import UserMenuDropdown from '../../common/components/UserMenuDropdown';
import { TOPBAR_HEIGHT } from '../../common/styles/topbarStyles';

/**
 * Single operational command surface for `/map`.
 * Left: feed connection dot + rail collapse (desktop). Center: FleetOperationalPills.
 * Right: notifications, user. Surfaces: --surface-card / --surface-border only
 * (no gradient/cyan chrome).
 *
 * No identity block and no "back to dashboard" control here — both moved to
 * the app shell's own spine, which now renders (icon-only) on this workspace
 * too, so Dashboard is just the first icon in it and organization identity is
 * shown once, consistently, instead of duplicated in this bar.
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
}) => {
  const socketConnected = useSelector((state) => !!state.session.socket);

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
        {(!desktop || !fleetCollapsed) && (
          <ConnectionIndicator socketConnected={socketConnected} />
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
        <NotificationCenter />
        <UserMenuDropdown />
      </Box>
    </Box>
  );
};

export default LiveMapTopBar;
