import {
  useCallback, useMemo, useState,
} from 'react';
import { Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { devicesActions, fleetInteractionActions } from '../store';
import usePersistedState from '../common/util/usePersistedState';
import useFilter from './useFilter';
import MainMap from './MainMap';
import PremiumTopBar from './components/PremiumTopBar';
import MapDevicePopup from './components/MapDevicePopup';
import FleetLayout from './fleet/FleetLayout';
import FleetSidebar from './fleet/FleetSidebar';

const useStyles = makeStyles()(() => ({
  root: {
    height: '100dvh',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  mainRow: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
}));

const MainPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items || {});
  const fleetTab = useSelector((state) => state.fleetInteraction.fleetTab);
  const fleetWorkspaceMode = useSelector((state) => state.fleetInteraction.fleetWorkspaceMode);
  const searchQuery = useSelector((state) => state.fleetInteraction.searchQuery);

  const [filteredPositions, setFilteredPositions] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const selectedPosition = filteredPositions.find((position) => selectedDeviceId && position.deviceId === selectedDeviceId);

  const [filter, setFilter] = usePersistedState('filter', {
    statuses: [],
    groups: [],
  });
  const [filterSort, setFilterSort] = usePersistedState('filterSort', '');
  const [filterMap, setFilterMap] = usePersistedState('filterMap', false);

  const effectiveFleetTab = fleetWorkspaceMode === 'live' ? fleetTab : 'all';

  useFilter(
    searchQuery,
    filter,
    filterSort,
    filterMap,
    positions,
    setFilteredDevices,
    setFilteredPositions,
    effectiveFleetTab,
  );

  const deviceStats = useMemo(() => {
    const total = Object.values(devices).length;
    const online = Object.values(devices).filter((d) => d.status === 'online').length;
    const moving = Object.values(positions).filter((p) => p.speed > 0).length;
    const idling = online - moving;
    const offline = Object.values(devices).filter((d) => d.status === 'offline').length;

    return { total, online, moving, idling, offline };
  }, [devices, positions]);

  const handleDashboardClick = useCallback(() => {
    navigate('/');
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
      <PremiumTopBar
        flatBottomOnMobile
        devices={Object.values(devices)}
        stats={deviceStats}
        onFilterChange={handlePremiumFilterChange}
        onNavigateToDashboard={handleDashboardClick}
        groups={Object.values(groups)}
        filters={{
          statuses: filter.statuses,
          groups: filter.groups,
          sortBy: filterSort,
          mapOnly: filterMap,
        }}
        hideCenterSearch
        mapRouteOperationalChrome
        showMobileFleetDrawerButton={!desktop}
        onOpenMobileFleetDrawer={() => dispatch(fleetInteractionActions.setMobileDrawerOpen(true))}
      />

      <Box
        className={classes.mainRow}
        sx={{
          mt: {
            xs: 'calc(env(safe-area-inset-top, 0px) + 50px)',
            md: 'calc(env(safe-area-inset-top, 0px) + 56px)',
          },
        }}
      >
        <FleetLayout
          sidebar={(opts) => (
            <FleetSidebar
              {...opts}
              filteredDevices={filteredDevices}
              positions={positions}
              groups={Object.values(groups)}
              filters={{
                statuses: filter.statuses,
                groups: filter.groups,
                sortBy: filterSort,
                mapOnly: filterMap,
              }}
              deviceStats={deviceStats}
              onFilterChange={handlePremiumFilterChange}
            />
          )}
          map={(
            <Box sx={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
              <MainMap
                filteredPositions={filteredPositions}
                selectedPosition={selectedPosition}
              />
              {selectedDeviceId && selectedPosition && devices[selectedDeviceId] && (
                <MapDevicePopup
                  device={devices[selectedDeviceId]}
                  position={selectedPosition}
                  onClose={handleClosePopup}
                />
              )}
            </Box>
          )}
        />
      </Box>
    </Box>
  );
};

export default MainPage;
