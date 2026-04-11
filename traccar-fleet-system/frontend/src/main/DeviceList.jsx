import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import { List } from 'react-window';
import { Box, Typography, Chip } from '@mui/material';
import { devicesActions } from '../store';
import { useEffectAsync } from '../reactHelper';
import DeviceRow from './DeviceRow';
import fetchOrThrow from '../common/util/fetchOrThrow';
import EmptyState from '../common/components/EmptyState';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(180deg, rgba(2, 6, 23, 0.98) 0%, rgba(10, 19, 36, 0.96) 100%)'
      : 'linear-gradient(180deg, rgba(250, 252, 255, 0.98) 0%, rgba(241, 247, 251, 0.98) 100%)',
  },
  statsBar: {
    display: 'flex',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.2, 1.25, 1.05, 1.25),
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    background: theme.palette.mode === 'dark'
      ? 'linear-gradient(180deg, rgba(14, 24, 39, 0.95) 0%, rgba(7, 14, 24, 0.9) 100%)'
      : 'linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(245, 250, 253, 0.92) 100%)',
    flexWrap: 'wrap',
    boxShadow: theme.palette.mode === 'dark'
      ? 'inset 0 -1px 0 rgba(255,255,255,0.03)'
      : 'inset 0 -1px 0 rgba(15,23,42,0.04)',
  },
  statChip: {
    fontWeight: 700,
    fontSize: '0.72rem',
    height: '28px',
    borderRadius: '999px',
    border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
    backdropFilter: 'blur(10px)',
    '& .MuiChip-label': {
      padding: theme.spacing(0, 1.05),
    },
  },
  sectionHeader: {
    padding: theme.spacing(1, 2, 0.5, 2),
    marginTop: theme.spacing(0.5),
  },
  sectionTitle: {
    fontSize: '0.688rem',
    fontWeight: 700,
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    opacity: 0.6,
  },
  listContainer: {
    flex: 1,
    position: 'relative',
  },
  list: {
    height: '100%',
    direction: theme.direction,
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
  listInner: {
    position: 'relative',
    padding: theme.spacing(0.85, 0, 1.2, 0),
  },
}));

const DeviceList = ({ devices }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const positions = useSelector((state) => state.session.positions);

  const [, setTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setTime(Date.now()), 60000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffectAsync(async () => {
    const response = await fetchOrThrow('/api/devices');
    dispatch(devicesActions.refresh(await response.json()));
  }, []);

  // Group devices by status
  const groupedDevices = useMemo(() => {
    const groups = {
      online: [],
      offline: [],
      unknown: [],
    };

    devices.forEach((device) => {
      const status = device.status || 'unknown';
      if (groups[status]) {
        groups[status].push(device);
      }
    });

    return groups;
  }, [devices]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = devices.length;
    const online = groupedDevices.online.length;
    const moving = Object.values(positions).filter(p => p.speed > 0).length;
    const idling = online - moving;

    return { total, online, moving, idling, offline: groupedDevices.offline.length };
  }, [devices, groupedDevices, positions]);

  if (devices.length === 0) {
    return (
      <Box className={classes.root}>
        <EmptyState
          icon="🚗"
          title="No Vehicles"
          message="Click the + button to add your first vehicle"
          actionLabel="Add Vehicle"
          onAction={() => {/* Navigation handled by MainToolbar */}}
        />
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      {/* Statistics Bar */}
      <Box className={classes.statsBar}>
        <Chip
          label={`${stats.total} Total`}
          size="small"
          className={classes.statChip}
          sx={{
            backgroundColor: alpha('#94a3b8', 0.12),
            color: theme => theme.palette.text.primary,
          }}
        />
        <Chip
          label={`${stats.moving} Moving`}
          size="small"
          className={classes.statChip}
          sx={{
            backgroundColor: alpha('#22c55e', 0.12),
            color: '#22c55e',
          }}
        />
        <Chip
          label={`${stats.idling} Idle`}
          size="small"
          className={classes.statChip}
          sx={{
            backgroundColor: alpha('#f59e0b', 0.12),
            color: '#f59e0b',
          }}
        />
        <Chip
          label={`${stats.offline} Offline`}
          size="small"
          className={classes.statChip}
          sx={{
            backgroundColor: alpha('#ef4444', 0.12),
            color: '#ef4444',
          }}
        />
      </Box>

      {/* Device List */}
      <Box className={classes.listContainer}>
        <div 
          className={classes.list}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <List
            className={classes.list}
            rowComponent={DeviceRow}
            rowCount={devices.length}
            rowHeight={96}
            rowProps={{ devices }}
            overscanCount={5}
            innerElementType={({ children, ...props }) => (
              <div {...props} className={classes.listInner}>
                {children}
              </div>
            )}
          />
        </div>
      </Box>
    </Box>
  );
};

export default DeviceList;
