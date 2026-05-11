import { useState } from 'react';
import { traccarFetch } from '../../config/traccarApi.js';

import {
  IconButton,
  Avatar,
  Popover,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Chip,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpIcon from '@mui/icons-material/Help';
import LogoutIcon from '@mui/icons-material/Logout';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { sessionActions } from '../../store';
import { nativePostMessage } from './NativeInterface';
import LogoImage from '../../login/LogoImage';

const UserMenuDropdown = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();

  const user = useSelector((state) => state.session.user);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await traccarFetch('/api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    navigate('/login');
    dispatch(sessionActions.updateUser(null));
    handleClose();
  };

  const handleProfile = () => {
    navigate('/settings/user/' + user.id);
    handleClose();
  };

  const handleSettings = () => {
    navigate('/settings/preferences');
    handleClose();
  };

  const open = Boolean(anchorEl);

  // Get user initials
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Determine user role
  const getUserRole = () => {
    if (user?.administrator) return 'Admin';
    if (user?.readonly) return 'Viewer';
    return 'Manager';
  };

  return (
    <>
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 1,
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            backgroundColor: 'primary.main',
            fontSize: '0.875rem',
            fontWeight: 700,
          }}
        >
          {getInitials(user?.name)}
        </Avatar>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {user?.name || 'User'}
          </Typography>
        </Box>
        <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 280,
            mt: 1,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                backgroundColor: '#06b6d4',
                fontSize: '1.25rem',
                fontWeight: 700,
              }}
            >
              {getInitials(user?.name)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" fontWeight={700}>
                {user?.name || 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email || 'No email'}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={getUserRole()}
                  size="small"
                  color={user?.administrator ? 'primary' : 'default'}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              </Box>
            </Box>
          </Box>

          {location.pathname === '/map' && (
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                justifyContent: 'center',
                alignItems: 'center',
                py: 1.25,
                px: 1,
              }}
            >
              <LogoImage
                color="#06b6d4"
                style={{
                  width: '44px',
                  height: '44px',
                  objectFit: 'contain',
                }}
              />
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          <List dense>
            <ListItemButton
              onClick={handleProfile}
              sx={{
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="My Profile" />
            </ListItemButton>

            <ListItemButton
              onClick={handleSettings}
              sx={{
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>

            <ListItemButton
              onClick={() => window.open('https://numztrak.com/help', '_blank')}
              sx={{
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <HelpIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Help & Support" />
            </ListItemButton>
          </List>

          <Divider sx={{ my: 1 }} />

          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 1,
              color: 'error.main',
              '&:hover': {
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'error.main' }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </Box>
      </Popover>
    </>
  );
};

export default UserMenuDropdown;


