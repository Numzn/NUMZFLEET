import { useState } from 'react';
import { traccarFetch } from '../../config/traccarApi.js';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Paper, BottomNavigation, BottomNavigationAction, Menu, MenuItem, Typography, Badge,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import MapIcon from '@mui/icons-material/Map';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

import { sessionActions } from '../../store';
import { useTranslation } from './LocalizationProvider';
import { useRestriction } from '../util/permissions';
import { nativePostMessage } from './NativeInterface';

/**
 * @param {Object} props
 * @param {'chrome'|'map'} [props.layer='chrome'] — `map` uses a higher z-index so the bar stays
 *   above full-bleed MapLibre / WebGL stacking; use when rendering over the live map surface.
 */
const BottomMenu = ({ layer = 'chrome' } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const user = useSelector((state) => state.session.user);
  const socket = useSelector((state) => state.session.socket);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const [anchorEl, setAnchorEl] = useState(null);

  const currentSelection = () => {
    if (location.pathname === `/settings/user/${user.id}`) {
      return 'account';
    } if (location.pathname.startsWith('/settings')) {
      return 'settings';
    } if (location.pathname.startsWith('/reports')) {
      return 'reports';
    } if (location.pathname === '/') {
      return 'dashboard';
    } if (location.pathname === '/map') {
      return 'map';
    }
    return null;
  };

  const handleAccount = () => {
    setAnchorEl(null);
    navigate(`/settings/user/${user.id}`);
  };

  const handleLogout = async () => {
    setAnchorEl(null);

    const notificationToken = window.localStorage.getItem('notificationToken');
    if (notificationToken && !user.readonly) {
      window.localStorage.removeItem('notificationToken');
      const tokens = user.attributes.notificationTokens?.split(',') || [];
      if (tokens.includes(notificationToken)) {
        const updatedUser = {
          ...user,
          attributes: {
            ...user.attributes,
            notificationTokens: tokens.length > 1 ? tokens.filter((it) => it !== notificationToken).join(',') : undefined,
          },
        };
        await traccarFetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        });
      }
    }

    await traccarFetch('/api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    navigate('/login');
    dispatch(sessionActions.updateUser(null));
  };

  const handleSelection = (event, value) => {
    switch (value) {
      case 'dashboard':
        navigate('/');
        break;
      case 'map':
        navigate('/map');
        break;
      case 'reports':
        if (selectedDeviceId != null) {
          navigate(`/reports/combined?deviceId=${selectedDeviceId}`);
        } else {
          navigate('/reports/combined');
        }
        break;
      case 'settings':
        navigate('/settings/preferences');
        break;
      case 'account':
        setAnchorEl(event.currentTarget);
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  const navZ = (theme) => (layer === 'map' ? theme.zIndex.modal + 600 : theme.zIndex.modal + 1);

  return (
    <Paper
      elevation={1}
      sx={(theme) => ({
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: navZ(theme),
        borderRadius: '10px 10px 0 0',
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.palette.mode === 'dark'
          ? '0 8px 18px rgba(0, 0, 0, 0.38)'
          : '0 8px 18px rgba(15, 23, 42, 0.12)',
        backdropFilter: 'blur(6px)',
        background: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.92 : 0.96),
      })}
    >
      <BottomNavigation
        value={currentSelection()}
        onChange={handleSelection}
        showLabels
        sx={{
          minHeight: 52,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 62,
            py: 0.5,
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.7rem',
            fontWeight: 600,
          },
        }}
      >
        <BottomNavigationAction
          label="Dashboard"
          icon={<DashboardIcon />}
          value="dashboard"
        />
        <BottomNavigationAction
          label={t('mapTitle')}
          icon={(
            <Badge
              variant="dot"
              overlap="circular"
              invisible={socket !== false}
              sx={{
                '& .MuiBadge-dot': {
                  backgroundColor: '#ef4444',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  animation: socket === false ? 'none' : undefined,
                },
              }}
            >
              <MapIcon />
            </Badge>
          )}
          value="map"
        />
        {!disableReports && (
          <BottomNavigationAction label={t('reportTitle')} icon={<DescriptionIcon />} value="reports" />
        )}
        <BottomNavigationAction label={t('settingsTitle')} icon={<SettingsIcon />} value="settings" />
        {readonly ? (
          <BottomNavigationAction label={t('loginLogout')} icon={<ExitToAppIcon />} value="logout" />
        ) : (
          <BottomNavigationAction label={t('settingsUser')} icon={<PersonIcon />} value="account" />
        )}
      </BottomNavigation>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        {...(layer === 'map'
          ? { slotProps: { paper: { sx: { zIndex: 2000 } } } }
          : {})}
      >
        <MenuItem onClick={handleAccount}>
          <Typography color="textPrimary">{t('settingsUser')}</Typography>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <Typography color="error">{t('loginLogout')}</Typography>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default BottomMenu;
