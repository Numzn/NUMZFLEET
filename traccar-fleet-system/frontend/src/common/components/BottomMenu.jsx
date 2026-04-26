import { useState } from 'react';
import { traccarPath } from '../../config/traccarApi.js';

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

const BottomMenu = () => {
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
        await fetch(traccarPath(`/api/users/${user.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        });
      }
    }

    await fetch(traccarPath('/api/session'), { method: 'DELETE' });
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

  return (
    <Paper
      elevation={8}
      sx={(theme) => ({
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: theme.zIndex.modal + 1,
        borderRadius: '14px 14px 0 0',
        overflow: 'hidden',
        border: `1px solid ${theme.palette.mode === 'dark' ? alpha('#67e8f9', 0.22) : alpha('#0f172a', 0.09)}`,
        boxShadow: theme.palette.mode === 'dark'
          ? '0 14px 34px rgba(0, 0, 0, 0.45)'
          : '0 14px 30px rgba(7, 89, 133, 0.18)',
        backdropFilter: 'blur(14px)',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(165deg, rgba(7, 15, 27, 0.94) 0%, rgba(11, 24, 43, 0.92) 100%)'
          : 'linear-gradient(165deg, rgba(255, 255, 255, 0.95) 0%, rgba(242, 248, 252, 0.95) 100%)',
      })}
    >
      <BottomNavigation value={currentSelection()} onChange={handleSelection} showLabels>
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
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
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
