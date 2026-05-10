import React from 'react';
import { 
  Paper, 
  Popper, 
  ClickAwayListener, 
  Box, 
  Typography, 
  Button,
  Chip,
  Divider,
  List
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import DeviceItem from './DeviceItem';

const useStyles = makeStyles()((theme) => ({
  dropdown: {
    width: 360,
    maxHeight: 440,
    overflow: 'hidden',
    borderRadius: theme.spacing(2.25),
    boxShadow: theme.palette.mode === 'dark'
      ? '0 24px 60px rgba(0, 0, 0, 0.42)'
      : '0 24px 56px rgba(15, 23, 42, 0.18)',
    border: `1px solid ${alpha('#67e8f9', theme.palette.mode === 'dark' ? 0.22 : 0.28)}`,
    backdropFilter: 'blur(16px)',
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(165deg, rgba(5, 12, 24, 0.95) 0%, rgba(11, 24, 42, 0.93) 100%)'
      : 'linear-gradient(165deg, rgba(255, 255, 255, 0.97) 0%, rgba(242, 248, 252, 0.96) 100%)',
  },
  header: {
    padding: theme.spacing(2.1, 2.2, 1.8, 2.2),
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(180deg, rgba(12, 27, 44, 0.95) 0%, rgba(7, 14, 24, 0.9) 100%)'
      : 'linear-gradient(180deg, rgba(238, 249, 253, 0.95) 0%, rgba(248, 252, 255, 0.92) 100%)',
  },
  statsRow: {
    display: 'flex',
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(1),
    flexWrap: 'wrap',
  },
  deviceList: {
    maxHeight: 318,
    overflowY: 'auto',
    '&::-webkit-scrollbar': {
      width: '6px',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: alpha('#67e8f9', 0.26),
      borderRadius: '3px',
      '&:hover': {
        backgroundColor: alpha('#67e8f9', 0.38),
      },
    },
  },
  viewAllButton: {
    width: '100%',
    marginTop: theme.spacing(1),
    borderRadius: theme.spacing(1.25),
    textTransform: 'none',
    fontWeight: 700,
  },
}));

const DeviceDropdown = ({
  open,
  anchorEl,
  onClose, 
  devices = [], 
  onViewAll,
  onDeviceSelect,
  keyword = ''
}) => {
  const { classes } = useStyles();
  const theme = useTheme();

  if (!open) return null;

  // Calculate device stats
  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const movingCount = devices.filter(d => d.speed > 0).length;

  // Filter devices based on keyword if provided
  const filteredDevices = keyword 
    ? devices.filter(device => 
        device.name?.toLowerCase().includes(keyword.toLowerCase()) ||
        device.uniqueId?.toLowerCase().includes(keyword.toLowerCase())
      )
    : devices;

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="bottom-start"
      style={{ zIndex: theme.zIndex.modal }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <Paper className={classes.dropdown}>
          {/* Header with stats */}
          <Box className={classes.header}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              {keyword ? `Search Results` : `Devices`} ({filteredDevices.length})
            </Typography>
            
            <Box className={classes.statsRow}>
              <Chip 
                label={`${onlineCount} Online`}
                size="small"
                variant="filled"
                sx={{
                  backgroundColor: alpha('#22c55e', 0.13),
                  color: '#22c55e',
                  border: `1px solid ${alpha('#22c55e', 0.28)}`,
                  fontWeight: 700,
                }}
              />
              <Chip 
                label={`${offlineCount} Offline`}
                size="small"
                variant="filled"
                sx={{
                  backgroundColor: alpha('#ef4444', 0.13),
                  color: '#ef4444',
                  border: `1px solid ${alpha('#ef4444', 0.28)}`,
                  fontWeight: 700,
                }}
              />
              <Chip 
                label={`${movingCount} Moving`}
                size="small"
                variant="filled"
                sx={{
                  backgroundColor: alpha('#38bdf8', 0.13),
                  color: '#0ea5e9',
                  border: `1px solid ${alpha('#38bdf8', 0.28)}`,
                  fontWeight: 700,
                }}
              />
            </Box>
          </Box>

          {/* Device list */}
          <Box className={classes.deviceList}>
            {filteredDevices.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {keyword ? 'No devices match your search' : 'No devices found'}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {filteredDevices.slice(0, 8).map((device) => (
                  <DeviceItem
                    key={device.id}
                    device={device}
                    onClick={() => {
                      onDeviceSelect(device);
                      onClose();
                    }}
                    compact
                  />
                ))}
              </List>
            )}
          </Box>

          {/* View All button */}
          {filteredDevices.length > 8 && (
            <>
              <Divider />
              <Box sx={{ p: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  className={classes.viewAllButton}
                  onClick={onViewAll}
                >
                  View All {filteredDevices.length} Devices
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
};

export default DeviceDropdown;




