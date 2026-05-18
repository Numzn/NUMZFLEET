import {
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  Box,
  Divider,
  Typography,
  Badge,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import FolderIcon from '@mui/icons-material/Folder';
import TodayIcon from '@mui/icons-material/Today';
import SendIcon from '@mui/icons-material/Send';
import HelpIcon from '@mui/icons-material/Help';
import PaymentIcon from '@mui/icons-material/Payment';
import CampaignIcon from '@mui/icons-material/Campaign';
import CalculateIcon from '@mui/icons-material/Calculate';
import BuildIcon from '@mui/icons-material/Build';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import NotificationCenter from '../../notifications/NotificationCenter';
import UserMenuDropdown from './UserMenuDropdown';
import usePersistedState from '../util/usePersistedState';
import { useAdministrator, useManager, useRestriction } from '../util/permissions';
import useFeatures from '../util/useFeatures';
import LogoImage from '../../login/LogoImage';
import { TOPBAR_HEIGHT } from '../styles/topbarStyles';
import { useTranslation } from './LocalizationProvider';

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
  subMenuItem: {
    paddingLeft: theme.spacing(5.5),
    padding: theme.spacing(0.875, 1.5, 0.875, 5.5),
    marginBottom: theme.spacing(0.25),
    '&:hover': {
      paddingLeft: theme.spacing(5.75),
      backgroundColor: theme.palette.action.hover,
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      left: theme.spacing(2.5),
      top: '50%',
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      backgroundColor: theme.palette.text.secondary,
      opacity: 0.4,
      transform: 'translateY(-50%)',
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

const SIDEBAR_WIDTH_EXPANDED = 168;
const SIDEBAR_WIDTH_COLLAPSED = 68;

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
  const userId = useSelector((state) => state.session.user.id);
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

  const [openState, setOpenState] = usePersistedState('unifiedSidebarNavOpen', {
    fleet: true,
    fuel: true,
    system: false,
  });

  const systemChildren = useMemo(() => {
    const out = [];
    if (!readonly) {
      out.push({ title: t('sharedPreferences'), path: '/settings/preferences', icon: TuneIcon });
      out.push({
        title: t('sharedNotifications'),
        path: '/settings/notifications',
        icon: NotificationsIcon,
        activeMatch: (path) => path.startsWith('/settings/notification'),
      });
      out.push({
        title: t('settingsUser'),
        path: `/settings/user/${userId}`,
        icon: PersonIcon,
        activeMatch: (path) => path === `/settings/user/${userId}`,
      });
      if (!features.disableGroups) {
        out.push({
          title: t('settingsGroups'),
          path: '/settings/groups',
          icon: FolderIcon,
          activeMatch: (path) => path.startsWith('/settings/group'),
        });
      }
      if (!features.disableCalendars) {
        out.push({
          title: t('sharedCalendars'),
          path: '/settings/calendars',
          icon: TodayIcon,
          activeMatch: (path) => path.startsWith('/settings/calendar'),
        });
      }
      if (!features.disableComputedAttributes) {
        out.push({
          title: t('sharedComputedAttributes'),
          path: '/settings/attributes',
          icon: CalculateIcon,
          activeMatch: (path) => path.startsWith('/settings/attribute'),
        });
      }
      if (!features.disableMaintenance) {
        out.push({
          title: t('sharedMaintenance'),
          path: '/settings/maintenances',
          icon: BuildIcon,
          activeMatch: (path) => path.startsWith('/settings/maintenance'),
        });
      }
      if (!features.disableSavedCommands) {
        out.push({
          title: t('sharedSavedCommands'),
          path: '/settings/commands',
          icon: SendIcon,
          activeMatch: (path) => path.startsWith('/settings/command'),
        });
      }
    }
    if (billingLink) {
      out.push({
        title: t('userBilling'),
        href: billingLink,
        icon: PaymentIcon,
        external: true,
      });
    }
    if (supportLink) {
      out.push({
        title: t('settingsSupport'),
        href: supportLink,
        icon: HelpIcon,
        external: true,
      });
    }
    if (manager && !readonly) {
      out.push({
        title: t('serverAnnouncement'),
        path: '/settings/announcement',
        icon: CampaignIcon,
      });
      if (admin) {
        out.push({
          title: t('settingsServer'),
          path: '/settings/server',
          icon: SettingsIcon,
        });
      }
      out.push({
        title: t('settingsUsers'),
        path: '/settings/users',
        icon: PeopleIcon,
        activeMatch: (path) => path.startsWith('/settings/user') && path !== `/settings/user/${userId}`,
      });
    }
    return out;
  }, [
    admin,
    billingLink,
    features.disableCalendars,
    features.disableComputedAttributes,
    features.disableGroups,
    features.disableMaintenance,
    features.disableSavedCommands,
    manager,
    readonly,
    supportLink,
    t,
    userId,
  ]);

  const navGroups = useMemo(() => ([
    {
      key: 'primary',
      items: [
        { title: 'Live Map', path: '/map', icon: MapOutlinedIcon },
        { title: 'Dashboard', path: '/', icon: DashboardOutlinedIcon },
      ],
    },
    {
      key: 'operations',
      label: 'OPERATIONS',
      items: [
        {
          key: 'fleet',
          title: 'Fleet',
          icon: DirectionsCarOutlinedIcon,
          show: !readonly,
          badge: alertsBadgeCount,
          children: [
            { title: 'Vehicles', path: '/fleet/vehicles', show: manager },
            { title: 'Drivers', path: '/settings/drivers', show: !features.disableDrivers },
            { title: 'Geofences', path: '/geofences' },
          ].filter((c) => c.show !== false),
        },
        {
          key: 'fuel',
          title: 'Fuel',
          icon: LocalGasStationOutlinedIcon,
          show: !readonly,
          badge: pendingFuelCount > 0 ? pendingFuelCount : undefined,
          children: [
            { title: 'Requests', path: '/fuel-requests' },
            { title: 'Sessions', path: '/fleet/operation-sessions' },
            { title: 'New session', path: '/fleet/operation-sessions/create' },
          ],
        },
      ].filter((i) => i.show !== false),
    },
    {
      key: 'intelligence',
      label: 'INTELLIGENCE',
      items: [
        { title: 'Analytics', path: '/reports/statistics', icon: InsightsOutlinedIcon },
        { title: 'Reports', path: '/reports/summary', icon: BarChartOutlinedIcon },
      ],
    },
    {
      key: 'system',
      label: 'SYSTEM',
      items: [
        {
          key: 'system',
          title: 'System',
          icon: SettingsOutlinedIcon,
          children: systemChildren,
        },
      ],
    },
  ]), [
    alertsBadgeCount,
    features.disableDrivers,
    manager,
    pendingFuelCount,
    readonly,
    systemChildren,
  ]);

  const pathActive = useCallback((path, exact = false) => {
    if (!path) return false;
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }, [location.pathname]);

  const isAnyChildActive = useCallback((children) => {
    if (!Array.isArray(children) || !children.length) return false;
    return children.some((c) => {
      if (c.external) return false;
      if (c.activeMatch) return c.activeMatch(location.pathname);
      return pathActive(c.path);
    });
  }, [location.pathname, pathActive]);

  const handleGo = useCallback((path) => {
    if (!path) return;
    navigate(path);
    onNavigate?.();
  }, [navigate, onNavigate]);

  const toggleOpen = useCallback((key) => {
    setOpenState((prev) => ({ ...(prev || {}), [key]: !prev?.[key] }));
  }, [setOpenState]);

  const buildTooltip = useCallback((item) => {
    if (!collapsed) return '';
    if (Array.isArray(item.children) && item.children.length) {
      const hint = item.children.slice(0, 3).map((c) => c.title).join(', ');
      return hint ? `${item.title} — ${hint}` : item.title;
    }
    return item.title;
  }, [collapsed]);

  const leafActive = useCallback((item) => {
    if (item.activeMatch) return item.activeMatch(location.pathname);
    if (!item.path) return false;
    return pathActive(item.path);
  }, [location.pathname, pathActive]);

  const renderLeaf = useCallback((item, opts = {}) => {
    const { dense = false, keyPrefix = '' } = opts;
    const active = leafActive(item);
    const tooltip = buildTooltip(item);

    const go = () => {
      if (item.external && item.href) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
        onNavigate?.();
        return;
      }
      handleGo(item.path);
    };

    const button = (
      <ListItemButton
        key={`${keyPrefix}${item.title}`}
        className={`${classes.menuItem} ${dense ? classes.subMenuItem : ''} ${active ? classes.menuItemActive : ''}`}
        onClick={go}
        sx={{
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 1 : undefined,
          minHeight: dense ? 40 : 44,
        }}
      >
        {item.icon && (
          <ListItemIcon
            className={`${classes.menuItemIcon} ${active ? classes.menuItemIconActive : ''}`}
            sx={{ minWidth: collapsed ? 'auto' : 38 }}
          >
            <item.icon />
          </ListItemIcon>
        )}
        {!collapsed && (
          <ListItemText primary={item.title} className={classes.menuItemText} />
        )}
      </ListItemButton>
    );

    return (
      <Tooltip
        key={`${keyPrefix}${item.title}-tt`}
        title={tooltip}
        placement="right"
        disableHoverListener={!collapsed}
      >
        <Box>
          {button}
        </Box>
      </Tooltip>
    );
  }, [buildTooltip, classes.menuItem, classes.menuItemActive, classes.menuItemIcon, classes.menuItemText, classes.subMenuItem, collapsed, handleGo, leafActive, onNavigate]);

  const renderParent = useCallback((item) => {
    const open = Boolean(openState?.[item.key]);
    const active = isAnyChildActive(item.children);
    const tooltip = buildTooltip(item);
    const Icon = item.icon;
    const badge = item.badge;

    const onClick = () => {
      if (collapsed) {
        const first = item.children?.find((c) => c.path);
        handleGo(first?.path);
        return;
      }
      toggleOpen(item.key);
    };

    const parentButton = (
      <ListItemButton
        key={item.title}
        className={`${classes.menuItem} ${active ? classes.menuItemActive : ''}`}
        onClick={onClick}
        sx={{
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 1 : undefined,
          minHeight: 44,
        }}
      >
        <ListItemIcon className={classes.menuItemIcon} sx={{ minWidth: collapsed ? 'auto' : 38 }}>
          {badge ? (
            <Badge badgeContent={badge} className={classes.badge}>
              <Icon />
            </Badge>
          ) : (
            <Icon />
          )}
        </ListItemIcon>
        {!collapsed && (
          <>
            <ListItemText primary={item.title} className={classes.menuItemText} />
            {open ? <ExpandLessOutlinedIcon fontSize="small" /> : <ExpandMoreOutlinedIcon fontSize="small" />}
          </>
        )}
      </ListItemButton>
    );

    return (
      <Box key={item.key || item.title}>
        <Tooltip title={tooltip} placement="right" disableHoverListener={!collapsed}>
          <Box>{parentButton}</Box>
        </Tooltip>
        {!collapsed && (
          <Collapse in={open} timeout={150} unmountOnExit>
            <List component="div" disablePadding>
              {item.children
                .filter((c) => c.show !== false)
                .map((c) => renderLeaf(c, { dense: true, keyPrefix: `${item.key}-` }))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  }, [buildTooltip, classes.badge, classes.menuItem, classes.menuItemActive, classes.menuItemIcon, classes.menuItemText, collapsed, handleGo, isAnyChildActive, openState, renderLeaf, toggleOpen]);

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
            color="#06b6d4"
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

        {navGroups.map((group) => (
          <Box key={group.key}>
            {group.label && !collapsed && (
              <Box className={classes.sectionHeader}>
                <Typography className={classes.sectionTitle}>{group.label}</Typography>
              </Box>
            )}
            {group.items.map((item) => {
              if (item.show === false) return null;
              if (item.children) return renderParent(item);
              return renderLeaf(item);
            })}
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
