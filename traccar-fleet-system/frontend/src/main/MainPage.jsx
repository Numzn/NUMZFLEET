import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { devicesActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import EventsDrawer from './EventsDrawer';
import useFilter from './useFilter';
import MainMap from './MainMap';
import PremiumTopBar from './components/PremiumTopBar';
import DeviceDropdown from './components/DeviceDropdown';
import MapDevicePopup from './components/MapDevicePopup';
import { useAttributePreference } from '../common/util/preferences';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100dvh',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    // Keep map content directly below fixed topbar without extra gap
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)',
    [theme.breakpoints.between('md', 'lg')]: {
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)',
    },
    [theme.breakpoints.down('md')]: {
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 50px)',
    },
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    height: '100%',
    minHeight: 0,
    paddingBottom: 0,
    [theme.breakpoints.down('md')]: {
      // Reserve only actual nav height + safe area
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
    },
  },
}));

const MainPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items || {});
  const [filteredPositions, setFilteredPositions] = useState([]);
  const selectedPosition = filteredPositions.find((position) => selectedDeviceId && position.deviceId === selectedDeviceId);

  const [filteredDevices, setFilteredDevices] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = usePersistedState('filter', {
    statuses: [],
    groups: [],
  });
  const [filterSort, setFilterSort] = usePersistedState('filterSort', '');
  const [filterMap, setFilterMap] = usePersistedState('filterMap', false);

  // New state for topbar components
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPinned, setDrawerPinned] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  
  const devicesButtonRef = useRef(null);

  const onEventsClick = useCallback(() => setEventsOpen(true), [setEventsOpen]);

  const handleDashboardClick = useCallback(() => {
    navigate('/');
  }, [navigate]);

  useFilter(keyword, filter, filterSort, filterMap, positions, setFilteredDevices, setFilteredPositions);

  // Auto-open drawer when device is selected
  useEffect(() => {
    if (selectedDeviceId) {
      setDrawerOpen(true);
    }
  }, [selectedDeviceId]);

  // Calculate device statistics
  const deviceStats = React.useMemo(() => {
    const total = Object.values(devices).length;
    const online = Object.values(devices).filter(d => d.status === 'online').length;
    const moving = Object.values(positions).filter(p => p.speed > 0).length;
    const idling = online - moving;
    const offline = Object.values(devices).filter(d => d.status === 'offline').length;

    return { total, online, moving, idling, offline };
  }, [devices, positions]);

  // Event handlers
  const handleDeviceSelect = useCallback((device) => {
    dispatch(devicesActions.selectId(device.id));
  }, [dispatch]);

  const handleDevicesClick = useCallback(() => {
    setDropdownOpen(!dropdownOpen);
  }, [dropdownOpen]);

  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(!drawerOpen);
  }, [drawerOpen]);

  const handleViewAllDevices = useCallback(() => {
    setDropdownOpen(false);
    setDrawerOpen(true);
  }, []);

  const handleAddDevice = useCallback(() => {
    navigate('/settings/device');
  }, [navigate]);

  const handleClosePopup = useCallback(() => {
    dispatch(devicesActions.selectId(null));
  }, [dispatch]);

  const handlePremiumFilterChange = useCallback((nextFilter) => {
    if (typeof nextFilter === 'string') {
      setFilter((prev) => ({ ...prev, statuses: [nextFilter] }));
      return;
    }

    setFilter({
      statuses: nextFilter.statuses || [],
      groups: nextFilter.groups || [],
    });
    setFilterSort(nextFilter.sortBy || '');
    setFilterMap(Boolean(nextFilter.mapOnly));
  }, [setFilter, setFilterSort, setFilterMap]);

  return (
    <Box className={classes.root}>
      {/* Topbar */}
      <PremiumTopBar
        devices={Object.values(devices)}
        stats={deviceStats}
        onSearch={setKeyword}
        onFilterChange={handlePremiumFilterChange}
        onNavigateToDashboard={handleDashboardClick}
        onShowAllDevices={handleViewAllDevices}
        groups={Object.values(groups)}
        filters={{
          statuses: filter.statuses,
          groups: filter.groups,
          sortBy: filterSort,
          mapOnly: filterMap,
        }}
      />

      {/* Device Dropdown */}
      <DeviceDropdown
        open={dropdownOpen}
        anchorEl={devicesButtonRef.current}
        onClose={() => setDropdownOpen(false)}
        onViewAll={handleViewAllDevices}
        devices={filteredDevices}
        onDeviceSelect={handleDeviceSelect}
        keyword={keyword}
      />

      {/* Map Container */}
      <Box className={classes.mapContainer}>
        <MainMap
          filteredPositions={filteredPositions}
          selectedPosition={selectedPosition}
          onEventsClick={() => setEventsOpen(true)}
          devicesOpen={drawerOpen}
          sidebarCollapsed={!drawerPinned}
        />
        
        {/* Device Popup */}
        {selectedDeviceId && selectedPosition && devices[selectedDeviceId] && (
          <MapDevicePopup
            device={devices[selectedDeviceId]}
            position={selectedPosition}
            onClose={handleClosePopup}
            initialPosition={{ x: 100, y: 100 }}
          />
        )}
      </Box>

    </Box>
  );
};

export default MainPage;