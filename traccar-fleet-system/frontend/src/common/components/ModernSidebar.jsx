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
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MapIcon from '@mui/icons-material/Map';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BuildIcon from '@mui/icons-material/Build';
import PeopleIcon from '@mui/icons-material/People';
import PlaceIcon from '@mui/icons-material/Place';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import FolderIcon from '@mui/icons-material/Folder';
import TodayIcon from '@mui/icons-material/Today';
import CalculateIcon from '@mui/icons-material/Calculate';
import SendIcon from '@mui/icons-material/Send';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import TuneIcon from '@mui/icons-material/Tune';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import usePersistedState from '../util/usePersistedState';
import { useAdministrator, useManager, useRestriction } from '../util/permissions';
import useFeatures from '../util/useFeatures';
import LogoImage from '../../login/LogoImage';

const useStyles = makeStyles()((theme) => ({
  brandHeader: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2, 2, 1.75),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundImage: 'linear-gradient(180deg, rgba(6, 182, 212, 0.06) 0%, transparent 100%)',
  },
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    // Subtle gradient for depth
    backgroundImage: 'linear-gradient(to bottom, rgba(6, 182, 212, 0.01) 0%, transparent 100%)',
  },
  menuList: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: theme.spacing(1.5, 1.25),
    // Custom scrollbar
    '&::-webkit-scrollbar': {
      width: '6px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(6, 182, 212, 0.2)',
      borderRadius: '3px',
      '&:hover': {
        backgroundColor: 'rgba(6, 182, 212, 0.3)',
      },
    },
  },
  sectionHeader: {
    padding: theme.spacing(1.75, 2, 0.75, 2),
    marginTop: theme.spacing(1.5),
    '&:first-of-type': {
      marginTop: 0,
    },
  },
  sectionTitle: {
    fontSize: '0.688rem',
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    opacity: 0.7,
  },
  menuItem: {
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(1, 1.5),
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    border: '1px solid transparent',
    '&:hover': {
      backgroundColor: 'rgba(6, 182, 212, 0.08)',
      borderColor: 'rgba(6, 182, 212, 0.15)',
      transform: 'translateX(3px)',
    },
    '&:active': {
      transform: 'scale(0.98) translateX(2px)',
    },
  },
  menuItemActive: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderColor: theme.palette.primary.main,
    boxShadow: '0 2px 12px rgba(6, 182, 212, 0.3)',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
      borderColor: theme.palette.primary.dark,
      transform: 'translateX(3px)',
    },
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.contrastText,
    },
    '& .MuiListItemText-primary': {
      fontWeight: 700,
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: '20%',
      bottom: '20%',
      width: '3px',
      backgroundColor: theme.palette.primary.contrastText,
      borderRadius: '0 3px 3px 0',
    },
  },
  menuItemIcon: {
    minWidth: 38,
    color: theme.palette.primary.main,
    '& .MuiSvgIcon-root': {
      fontSize: '1.3rem',
      transition: 'transform 0.15s',
    },
    '&:hover .MuiSvgIcon-root': {
      transform: 'scale(1.1)',
    },
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
      backgroundColor: 'rgba(6, 182, 212, 0.06)',
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
  expandIcon: {
    color: theme.palette.text.secondary,
    opacity: 0.7,
    fontSize: '1.125rem',
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  expandIconOpen: {
    transform: 'rotate(90deg)',
    color: theme.palette.primary.main,
    opacity: 1,
  },
  divider: {
    margin: theme.spacing(2.5, 2),
    backgroundColor: theme.palette.divider,
    opacity: 0.5,
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
}));

const ModernSidebar = ({ showMobileBrand = false }) => {
  const { classes } = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Permissions
  const readonly = useRestriction('readonly');
  const admin = useAdministrator();
  const manager = useManager();
  const features = useFeatures();
  const userId = useSelector((state) => state.session.user?.id);
  
  // Get pending counts for badges
  const fuelRequests = useSelector((state) => state.fuelRequests?.items || {});
  const pendingFuelCount = Object.values(fuelRequests).filter((request) => {
    const status = request.status?.toLowerCase?.() || '';
    return status === 'pending' || status === 'submitted' || status === 'awaiting_approval';
  }).length;
  
  // Collapsible sections state (persisted)
  const [reportsOpen, setReportsOpen] = usePersistedState('sidebarReportsOpen', false);
  const [fuelOpen, setFuelOpen] = usePersistedState('sidebarFuelOpen', false);
  const [settingsOpen, setSettingsOpen] = usePersistedState('sidebarSettingsOpen', false);

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Main navigation sections
  const mainNavItems = [
    {
      title: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/',
      exact: true,
      tooltip: 'Fleet Overview Dashboard',
    },
    {
      title: 'Live Map',
      icon: <MapIcon />,
      path: '/map',
      tooltip: 'Real-time Vehicle Tracking',
    },
  ];

  const fleetNavItems = [
    {
      title: 'Fleet',
      icon: <DirectionsCarIcon />,
      path: '/settings/devices',
      show: !readonly,
      tooltip: 'Manage Vehicles',
    },
    {
      title: 'Fuel Management',
      icon: <LocalGasStationIcon />,
      hasSubmenu: true,
      open: fuelOpen,
      onToggle: () => setFuelOpen(!fuelOpen),
      show: !readonly,
      badge: pendingFuelCount,
      submenu: [
        { title: 'Fuel Requests', path: '/fuel-requests', badge: pendingFuelCount },
        { title: 'Vehicles', path: '/fleet/vehicles' },
        { title: 'Fuel Stations', path: '/settings/preferences' },
      ],
    },
    {
      title: 'Geofences',
      icon: <PlaceIcon />,
      path: '/geofences',
      show: !readonly,
      tooltip: 'Virtual Boundaries',
    },
    {
      title: 'Drivers',
      icon: <PeopleIcon />,
      path: '/settings/drivers',
      show: !readonly && !features.disableDrivers,
      tooltip: 'Driver Management',
    },
    {
      title: 'Maintenance',
      icon: <BuildIcon />,
      path: '/settings/maintenances',
      show: !readonly && !features.disableMaintenance,
      tooltip: 'Service Schedules',
    },
  ].filter(item => item.show !== false);

  const analyticsNavItems = [
    {
      title: 'Reports',
      icon: <AssessmentIcon />,
      hasSubmenu: true,
      open: reportsOpen,
      onToggle: () => setReportsOpen(!reportsOpen),
      submenu: [
        { title: 'Summary', path: '/reports/summary' },
        { title: 'Trips', path: '/reports/trips' },
        { title: 'Stops', path: '/reports/stops' },
        { title: 'Events', path: '/reports/events' },
        { title: 'Statistics', path: '/reports/statistics' },
      ],
    },
  ];

  const settingsNavItems = [
    {
      title: 'Settings',
      icon: <SettingsIcon />,
      hasSubmenu: true,
      open: settingsOpen,
      onToggle: () => setSettingsOpen(!settingsOpen),
      show: !readonly,
      submenu: [
        { title: 'Preferences', path: '/settings/preferences', icon: <TuneIcon /> },
        { title: 'Notifications', path: '/settings/notifications', icon: <NotificationsIcon /> },
        { title: 'My Profile', path: `/settings/user/${userId}`, icon: <PersonIcon /> },
        { title: 'Groups', path: '/settings/groups', icon: <FolderIcon />, show: !features.disableGroups },
        { title: 'Calendars', path: '/settings/calendars', icon: <TodayIcon />, show: !features.disableCalendars },
        { title: 'Attributes', path: '/settings/attributes', icon: <CalculateIcon />, show: !features.disableComputedAttributes },
        { title: 'Commands', path: '/settings/commands', icon: <SendIcon />, show: !features.disableSavedCommands },
      ].filter(item => item.show !== false),
    },
  ].filter(item => item.show !== false);

  const adminNavItems = manager ? [
    {
      title: 'Server Settings',
      icon: <SettingsIcon />,
      path: '/settings/server',
      show: admin,
      tooltip: 'Server Configuration',
    },
    {
      title: 'User Management',
      icon: <SupervisorAccountIcon />,
      path: '/settings/users',
      tooltip: 'Manage System Users',
    },
  ].filter(item => item.show !== false) : [];

  const handleNavigation = (path) => {
    navigate(path);
  };

  const renderMenuItem = (item, isSubmenu = false) => {
    const active = isActive(item.path, item.exact);
    const hasActiveSubmenu = item.hasSubmenu && item.submenu?.some(sub => isActive(sub.path));
    
    return (
      <Tooltip 
        key={item.title} 
        title={item.tooltip || ''} 
        placement="right"
        disableHoverListener={!item.tooltip}
      >
        <Box>
          <ListItemButton
            className={`${classes.menuItem} ${isSubmenu ? classes.subMenuItem : ''} ${active ? classes.menuItemActive : ''}`}
            onClick={item.hasSubmenu ? item.onToggle : () => handleNavigation(item.path)}
          >
            {item.icon && (
              <ListItemIcon className={classes.menuItemIcon}>
                {item.badge ? (
                  <Badge badgeContent={item.badge} className={classes.badge}>
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
            )}
            
            <ListItemText 
              primary={item.title}
              className={classes.menuItemText}
            />
            
            {item.badge && !item.icon && (
              <Badge badgeContent={item.badge} className={classes.badge} />
            )}
            
            {item.hasSubmenu && (
              <ChevronRightIcon 
                className={`${classes.expandIcon} ${item.open ? classes.expandIconOpen : ''}`}
              />
            )}
          </ListItemButton>

          {item.hasSubmenu && (
            <Collapse in={item.open} timeout={200} unmountOnExit>
              <List component="div" disablePadding>
                {item.submenu.map((subItem) => renderMenuItem(subItem, true))}
              </List>
            </Collapse>
          )}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box className={classes.root}>
      {showMobileBrand && (
        <Box className={classes.brandHeader}>
          <LogoImage
            color="#06b6d4"
            style={{ width: '48px', height: '48px', objectFit: 'contain' }}
          />
        </Box>
      )}
      <List className={classes.menuList}>
        {/* Main Section */}
        {mainNavItems.map((item) => renderMenuItem(item))}
        
        {/* Fleet Management Section */}
        {fleetNavItems.length > 0 && (
          <>
            <Box className={classes.sectionHeader}>
              <Typography className={classes.sectionTitle}>
                Fleet Operations
              </Typography>
            </Box>
            {fleetNavItems.map((item) => renderMenuItem(item))}
          </>
        )}

        {/* Analytics Section */}
        {analyticsNavItems.length > 0 && (
          <>
            <Box className={classes.sectionHeader}>
              <Typography className={classes.sectionTitle}>
                Analytics
              </Typography>
            </Box>
            {analyticsNavItems.map((item) => renderMenuItem(item))}
          </>
        )}

        {/* Settings Section */}
        {settingsNavItems.length > 0 && (
          <>
            <Box className={classes.sectionHeader}>
              <Typography className={classes.sectionTitle}>
                Configuration
              </Typography>
            </Box>
            {settingsNavItems.map((item) => renderMenuItem(item))}
          </>
        )}

        {/* Admin Section */}
        {adminNavItems.length > 0 && (
          <>
            <Divider className={classes.divider} />
            <Box className={classes.sectionHeader}>
              <Typography className={classes.sectionTitle}>
                Administration
              </Typography>
            </Box>
            {adminNavItems.map((item) => renderMenuItem(item))}
          </>
        )}
      </List>
    </Box>
  );
};

export default ModernSidebar;

