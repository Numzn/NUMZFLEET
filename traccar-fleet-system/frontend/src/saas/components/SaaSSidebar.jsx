import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import BusinessIcon from '@mui/icons-material/Business';
import GroupsIcon from '@mui/icons-material/Groups';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import DashboardIcon from '@mui/icons-material/Dashboard';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--surface-card)',
    borderRight: '1px solid var(--surface-border)',
  },
  header: {
    padding: theme.spacing(2),
    borderBottom: '1px solid var(--surface-border)',
  },
  headerTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: 0,
  },
  listItem: {
    paddingX: theme.spacing(1),
    marginY: theme.spacing(0.5),
  },
  listItemButton: {
    borderRadius: theme.spacing(0.75),
    '&.Mui-selected': {
      backgroundColor: 'var(--primary-light)',
      color: theme.palette.primary.main,
      '& .MuiListItemIcon-root': {
        color: theme.palette.primary.main,
      },
    },
  },
  divider: {
    marginY: theme.spacing(1),
  },
  section: {
    padding: theme.spacing(2, 1),
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
    paddingX: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
}));

/**
 * SaaS Sidebar Navigation
 * Shows organization management options based on current user context
 * Platform admin sees: Partners, Direct Customers, Overview
 * Partner admin sees: My Customers
 * Customer users see: Fleet (default app)
 */
const SaaSSidebar = ({ isCollapsed = false }) => {
  const { classes, cx } = useStyles();
  const navigate = useNavigate();
  const location = useLocation();

  const currentContext = useSelector((state) => state.organizations.currentContext);

  if (!currentContext) {
    return null;
  }

  // Navigation structure based on context
  const getPlatformMenuItems = () => [
    {
      label: 'Overview',
      path: '/saas/platform/overview',
      icon: AnalyticsIcon,
    },
    {
      label: 'Partners',
      path: '/saas/platform/partners',
      icon: BusinessIcon,
    },
    {
      label: 'Direct Customers',
      path: '/saas/platform/direct-customers',
      icon: GroupsIcon,
    },
  ];

  const getPartnerMenuItems = () => [
    {
      label: 'My Customers',
      path: '/saas/partner/customers',
      icon: GroupsIcon,
    },
  ];

  const getFleetMenuItems = () => [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: DashboardIcon,
    },
  ];

  let menuItems = [];
  let sectionLabel = '';

  if (currentContext.type === 'platform') {
    menuItems = getPlatformMenuItems();
    sectionLabel = 'Platform Management';
  } else if (currentContext.type === 'partner') {
    menuItems = getPartnerMenuItems();
    sectionLabel = 'Partner Management';
  } else if (currentContext.type === 'customer') {
    menuItems = getFleetMenuItems();
    sectionLabel = 'Fleet';
  }

  const isActive = (path) => location.pathname === path;

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography className={classes.headerTitle}>
          {sectionLabel}
        </Typography>
      </Box>

      <List className={classes.list}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <ListItem
              key={item.path}
              className={classes.listItem}
              disablePadding
            >
              <ListItemButton
                className={cx(classes.listItemButton)}
                selected={isActive(item.path)}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon />
                </ListItemIcon>
                {!isCollapsed && <ListItemText primary={item.label} />}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default SaaSSidebar;
