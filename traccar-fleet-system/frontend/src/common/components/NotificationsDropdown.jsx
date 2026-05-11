import { useState } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Button,
  Divider,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import WarningIcon from '@mui/icons-material/Warning';
import BuildIcon from '@mui/icons-material/Build';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const NotificationsDropdown = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  
  const fuelRequests = useSelector((state) => state.fuelRequests?.items || {});
  const events = useSelector((state) => state.events?.items || {});
  
  // Get pending fuel requests
  const pendingRequests = Object.values(fuelRequests).filter(
    (req) => req.status === 'pending'
  );
  
  // Get recent events
  const recentEvents = Object.values(events).slice(0, 3);
  
  const totalNotifications = pendingRequests.length + recentEvents.length;

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleFuelRequestClick = () => {
    navigate('/');
    handleClose();
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={handleClick}
      >
        <Badge badgeContent={totalNotifications} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

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
            width: 360,
            maxHeight: 500,
            mt: 1,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              Notifications
            </Typography>
            {totalNotifications > 0 && (
              <Button size="small" onClick={() => {}}>
                Mark all read
              </Button>
            )}
          </Box>

          <Divider sx={{ mb: 2 }} />

          {totalNotifications === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography color="text.secondary">
                No new notifications
              </Typography>
            </Box>
          ) : (
            <List dense>
              {pendingRequests.map((request) => (
                <ListItemButton
                  key={request.id}
                  onClick={handleFuelRequestClick}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    backgroundColor: 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                  }}
                >
                  <ListItemIcon>
                    <LocalGasStationIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary="New Fuel Request"
                    secondary={`Device ${request.deviceId} - ${request.requestedAmount}L`}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                </ListItemButton>
              ))}

              {recentEvents.map((event) => (
                <ListItemButton
                  key={event.id}
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  <ListItemIcon>
                    <WarningIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary={event.type || 'Alert'}
                    secondary={event.deviceId ? `Device ${event.deviceId}` : 'System'}
                  />
                </ListItemButton>
              ))}
            </List>
          )}

          <Divider sx={{ my: 2 }} />
          
          <Button
            fullWidth
            variant="text"
            onClick={() => {
              navigate('/');
              handleClose();
            }}
          >
            View All Notifications
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationsDropdown;


