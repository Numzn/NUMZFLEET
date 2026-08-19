import {
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Box,
  Divider,
  Typography,
  Badge,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
// Outlined throughout — Help and Payment were the only filled icons in the
// sidebar, which read as heavier than everything beside them.
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import NotificationCenter from '../../notifications/NotificationCenter';
import UserMenuDropdown from './UserMenuDropdown';
import usePersistedState from '../util/usePersistedState';
import { useAdministrator, useManager, useRestriction } from '../util/permissions';
import useFeatures from '../util/useFeatures';
import LogoImage from '../../login/LogoImage';
import { TOPBAR_HEIGHT } from '../styles/topbarStyles';
import { useTranslation } from './LocalizationProvider';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';
import { isSettingsWorkspace, resolveExitTarget } from '../util/navWorkspace.js';
import { buildSettingsNavGroups } from '../../settings/center/settingsSectionRegistry.js';
import { useSuperAdmin, useTechnician } from '../util/permissions';
import { resolveNavigation } from '../util/navigationResolver';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--surface-card)',
    borderRight: '1px solid var(--color-border)',
    overflowX: 'hidden',
    minWidth: 0,
  },
  menuList: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: theme.spacing(1.25, 1),
    '&::-webkit-scrollbar': {
      width: '6px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'var(--color-border)',
      borderRadius: '3px',
      '&:hover': {
        backgroundColor: 'var(--color-border-hover)',
      },
    },
  },
  sectionHeader: {
    padding: 'var(--space-3) var(--space-4)',
    marginTop: 'var(--space-3)',
    '&:first-of-type': {
      marginTop: 0,
    },
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: 'var(--color-text-secondary)',
  },
  menuItem: {
    borderRadius: 'var(--radius-md)',
    marginBottom: theme.spacing(0.25),
    minHeight: 40,
    padding: '0 var(--space-4)',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    position: 'relative',
    '&:hover': {
      backgroundColor: 'var(--color-surface-alt)',
    },
  },
  menuItemActive: {
    backgroundColor: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    '&:hover': {
      backgroundColor: 'var(--color-primary-light)',
    },
    '& .MuiListItemIcon-root': {
      color: 'var(--color-primary)',
    },
    '& .MuiListItemText-primary': {
      fontWeight: 600,
      color: 'var(--color-primary)',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: '20%',
      bottom: '20%',
      width: '3px',
      backgroundColor: 'var(--color-primary)',
      borderRadius: '0 3px 3px 0',
    },
  },
  menuItemIcon: {
    minWidth: 36,
    color: 'var(--color-text-secondary)',
    '& .MuiSvgIcon-root': {
      fontSize: '20px',
    },
  },
  menuItemIconActive: {
    color: theme.palette.primary.main,
  },
  menuItemText: {
    '& .MuiListItemText-primary': {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '0.01em',
    },
  },
  badge: {
    '& .MuiBadge-badge': {
      backgroundColor: theme.palette.error.main,
      color: theme.palette.primary.contrastText,
      fontWeight: 700,
      fontSize: '0.625rem',
      minWidth: '18px',
      height: '18px',
      padding: '0 4px',
    },
  },
  footer: {
    padding: theme.spacing(1, 1.25, 1.25, 1.25),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: 'var(--surface-card)',
  },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
}));

// 168 was too narrow to fit "Driver requests" or a label plus its badge without
// truncating, and 68 was wider than an icon rail needs (40px target + gutters).
// Reference points: Linear 240/54, GitHub 296, Stripe 240.
const SIDEBAR_WIDTH_EXPANDED = 240;
const SIDEBAR_WIDTH_COLLAPSED = 56;

const UnifiedSidebar = ({
  collapsed: collapsedProp,
  setCollapsed: setCollapsedProp,
  forceExpanded = false,
  showHeaderLogo = false,
  onNavigate,
} = {}) => {
  const { classes } = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const admin = useAdministrator();
  const manager = useManager();
  const features = useFeatures();
  const user = useSelector((state) => state.session.user);
  const currentContext = useSelector((state) => state.organizations?.currentContext);
  const [maintenanceBadge, setMaintenanceBadge] = useState(undefined);

  useEffect(() => {
    if (!user || !manager || readonly) return undefined;
    let cancelled = false;
    fetch('/api/fleet/maintenance/dashboard', {
      headers: fuelApiAuthHeaders(user),
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.kpis) return;
        const count = (data.kpis.overdue || 0) + (data.kpis.dueToday || 0);
        setMaintenanceBadge(count > 0 ? count : undefined);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, manager, readonly]);
  const supportLink = useSelector((state) => state.session.server.attributes.support);
  const billingLink = useSelector((state) => state.session.user.attributes.billingLink);

  const fuelRequests = useSelector((state) => state.fuelRequests?.items || {});
  const pendingFuelCount = Object.values(fuelRequests).filter((request) => {
    const status = request.status?.toLowerCase?.() || '';
    return status === 'pending' || status === 'submitted' || status === 'awaiting_approval';
  }).length;

  const liveAlertBufferCount = useSelector((state) => state.events?.items?.length ?? 0);
  const alertsBadgeCount =
    liveAlertBufferCount > 0 ? Math.min(liveAlertBufferCount, 99) : undefined;

  const [collapsedState, setCollapsedState] = usePersistedState('sidebarCollapsed', false);
  const collapsed = forceExpanded ? false : (collapsedProp ?? collapsedState);
  const setCollapsed = setCollapsedProp ?? setCollapsedState;

  const technician = useTechnician();
  const platformOwner = useSuperAdmin();
  const inSettings = isSettingsWorkspace(location.pathname);

  // Where "Exit Settings" returns to. Held in a ref rather than state because it
  // must not re-render the sidebar as the user moves around the app — it is only
  // ever read at the moment Exit is rendered.
  const lastOperationalPath = useRef(null);
  useEffect(() => {
    if (!inSettings) {
      lastOperationalPath.current = `${location.pathname}${location.search}`;
    }
  }, [inSettings, location.pathname, location.search]);

  /**
   * Settings replaces the sidebar's contents rather than adding a second rail
   * beside it — entering Settings is a workspace switch, not a nested panel.
   */
  const settingsNavGroups = useMemo(() => {
    if (!inSettings) return [];
    const groups = buildSettingsNavGroups({
      manager, admin, technician, platformOwner, features,
    });
    return [
      {
        key: 'exit',
        items: [{
          title: 'Exit Settings',
          path: resolveExitTarget(lastOperationalPath.current),
          icon: ArrowBackOutlinedIcon,
        }],
      },
      ...groups.map((group) => ({
        key: group.key,
        label: group.label ? group.label.toUpperCase() : undefined,
        items: group.sections.map((section) => ({
          title: section.label,
          path: section.path,
          icon: section.icon,
          activeMatch: section.match,
          disabled: !section.live,
          disabledTooltip: !section.live ? `${section.label} — coming soon` : undefined,
        })),
      })),
    ];
  }, [admin, features, inSettings, manager, platformOwner, technician]);

  // External system items (billing/support links) are added to all contexts
  const externalSystemItems = useMemo(() => {
    const out = [];
    if (billingLink) {
      out.push({
        title: t('userBilling'),
        href: billingLink,
        icon: PaymentOutlinedIcon,
        external: true,
      });
    }
    if (supportLink) {
      out.push({
        title: t('settingsSupport'),
        href: supportLink,
        icon: HelpOutlineOutlinedIcon,
        external: true,
      });
    }
    return out;
  }, [billingLink, supportLink, t]);

  // Context-aware navigation resolver
  // Returns the appropriate navigation structure based on current organization context
  const navGroups = useMemo(() => {
    // If in Settings workspace, use Settings navigation (unchanged)
    if (inSettings) {
      return []; // Handled separately by settingsNavGroups below
    }

    // Otherwise use context-aware navigation
    return resolveNavigation(currentContext, {
      alertsBadgeCount,
      pendingFuelCount,
      maintenanceBadge,
      manager,
      admin,
      readonly,
      features,
      externalSystemItems,
    });
  }, [
    inSettings,
    currentContext,
    alertsBadgeCount,
    pendingFuelCount,
    maintenanceBadge,
    manager,
    admin,
    readonly,
    features,
    externalSystemItems,
  ]);

  const pathActive = useCallback((path, exact = false) => {
    if (!path) return false;
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }, [location.pathname]);

  const handleGo = useCallback((path) => {
    if (!path) return;
    navigate(path);
    onNavigate?.();
  }, [navigate, onNavigate]);

  const buildTooltip = useCallback((item) => {
    if (!collapsed) return '';
    return item.title;
  }, [collapsed]);

  const leafActive = useCallback((item) => {
    if (item.activeMatch) return item.activeMatch(location.pathname);
    if (!item.path) return false;
    return pathActive(item.path);
  }, [location.pathname, pathActive]);

  const renderLeaf = useCallback((item) => {
    const active = leafActive(item);
    const tooltip = buildTooltip(item);
    const { badge } = item;

    const go = () => {
      if (item.disabled) return;
      if (item.external && item.href) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
        onNavigate?.();
        return;
      }
      handleGo(item.path);
    };

    const tooltipTitle = item.disabled && item.disabledTooltip
      ? item.disabledTooltip
      : tooltip;

    const button = (
      <ListItemButton
        key={item.title}
        className={`${classes.menuItem} ${active ? classes.menuItemActive : ''}`}
        onClick={go}
        disabled={item.disabled}
        aria-label={badge ? `${item.title}, ${item.badgeHint || `${badge} pending`}` : item.title}
        sx={{
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 1 : undefined,
          minHeight: 44,
        }}
      >
        {item.icon && (
          <ListItemIcon
            className={`${classes.menuItemIcon} ${active ? classes.menuItemIconActive : ''}`}
            sx={{ minWidth: collapsed ? 'auto' : 38 }}
          >
            {/* Badges only ever rendered on the accordion parents, so a badge on
                a plain item — Maintenance already had one — silently never
                showed. The sidebar was fetching the maintenance dashboard on
                every mount to compute a number nothing displayed. */}
            {badge ? (
              <Badge badgeContent={badge} className={classes.badge}>
                <item.icon />
              </Badge>
            ) : (
              <item.icon />
            )}
          </ListItemIcon>
        )}
        {!collapsed && (
          <ListItemText primary={item.title} className={classes.menuItemText} />
        )}
      </ListItemButton>
    );

    return (
      <Tooltip
        key={`${item.title}-tt`}
        title={tooltipTitle}
        placement="right"
        disableHoverListener={!collapsed && !item.disabled}
      >
        <Box>
          {button}
        </Box>
      </Tooltip>
    );
  }, [buildTooltip, classes.badge, classes.menuItem, classes.menuItemActive, classes.menuItemIcon, classes.menuItemText, collapsed, handleGo, leafActive, onNavigate]);

  return (
    <Box
      className={classes.root}
      sx={{
        width: (forceExpanded || showHeaderLogo) ? '100%' : (collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED),
      }}
    >
      {showHeaderLogo && !forceExpanded && (
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            px: collapsed ? 0.5 : 1.5,
            pt: 'env(safe-area-inset-top, 0px)',
            minHeight: `calc(env(safe-area-inset-top, 0px) + ${TOPBAR_HEIGHT}px)`,
            borderBottom: 1,
            borderColor: 'divider',
            boxSizing: 'border-box',
          }}
        >
          <LogoImage
            color="var(--color-brand-accent)"
            style={{
              width: collapsed ? 36 : 44,
              height: collapsed ? 36 : 44,
              objectFit: 'contain',
            }}
          />
        </Box>
      )}

      <List className={classes.menuList}>
        {!showHeaderLogo && (
          <Box sx={{ px: collapsed ? 1.25 : 1.5, py: 1.5 }}>
            {!collapsed && (
              <Typography variant="subtitle2" fontWeight={800} letterSpacing="0.14em" color="primary.main">
                NUMZFLEET
              </Typography>
            )}
          </Box>
        )}

        {(inSettings ? settingsNavGroups : navGroups).map((group) => (
          <Box key={group.key}>
            {group.label && !collapsed && (
              <Box className={classes.sectionHeader}>
                <Typography className={classes.sectionTitle}>{group.label}</Typography>
              </Box>
            )}
            {group.items.map((item) => {
              if (item.show === false) return null;
              return renderLeaf(item);
            })}
            {/* The Exit action is the workspace switch, not a destination —
                separated so it does not read as the first Settings section. */}
            {group.key === 'exit' && <Divider sx={{ my: 1, opacity: 0.5 }} />}
          </Box>
        ))}
      </List>

      {!forceExpanded && (
        <Box className={classes.footer}>
          <Box className={classes.footerRow} sx={{ mb: 0.75 }}>
            <NotificationCenter />
            <UserMenuDropdown />
          </Box>
          <Divider sx={{ opacity: 0.35, mb: 1 }} />
          <Tooltip title={collapsed ? 'Expand' : 'Collapse'} placement="right" disableHoverListener={!collapsed}>
            <Box>
              <ListItemButton
                className={classes.menuItem}
                onClick={() => setCollapsed(!collapsed)}
                sx={{ justifyContent: collapsed ? 'center' : 'flex-start', minHeight: 44 }}
              >
                <ListItemIcon className={classes.menuItemIcon} sx={{ minWidth: collapsed ? 'auto' : 38 }}>
                  {collapsed ? <ChevronRightOutlinedIcon /> : <ChevronLeftOutlinedIcon />}
                </ListItemIcon>
                {!collapsed && <ListItemText primary="Collapse" className={classes.menuItemText} />}
              </ListItemButton>
            </Box>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default UnifiedSidebar;
