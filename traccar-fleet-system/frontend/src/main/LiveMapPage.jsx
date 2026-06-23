import {
  useCallback, useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { Box } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { devicesActions, fleetInteractionActions } from '../store';
import { selectAllNotifications } from '../store/notifications/notificationSelectors.js';
import usePersistedState from '../common/util/usePersistedState';
import useFilter from './useFilter';
import MainMap from './MainMap';
import { useVehicleDisplayContext } from '../fleet/display/VehicleDisplayRegistryContext';
import { useLiveMapChrome } from './fleet/LiveMapChromeContext';
import FleetCommandSheet from './fleet/FleetCommandSheet';
import VehicleContextCard from './fleet/mobile/VehicleContextCard';
import { isFleetCommandSheetEnabled, setFleetSheetHeightCssVar } from './fleet/fleetSheetConstants';
import useDriverPhonesByDeviceId from './fleet/mobile/useDriverPhonesByDeviceId';

const LiveMapPage = () => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useDispatch();
  const { setLiveMapChrome } = useLiveMapChrome();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items || {});
  const fleetTab = useSelector((state) => state.fleetInteraction.fleetTab);
  const fleetWorkspaceMode = useSelector((state) => state.fleetInteraction.fleetWorkspaceMode);
  const searchQuery = useSelector((state) => state.fleetInteraction.searchQuery);
  const allNotifications = useSelector(selectAllNotifications);
  const sheetCommandEnabled = isFleetCommandSheetEnabled() && !desktop;

  const [filteredPositions, setFilteredPositions] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const { fleetVehicleIdByDeviceId: deviceFleetVehicleIdByDeviceId } = useVehicleDisplayContext();
  const selectedDevice = selectedDeviceId != null ? devices[selectedDeviceId] : undefined;
  const selectedPosition = useMemo(
    () => (selectedDeviceId != null ? positions[selectedDeviceId] : undefined),
    [positions, selectedDeviceId],
  );

  const [filter, setFilter] = usePersistedState('filter', {
    statuses: [],
    groups: [],
  });
  const [filterSort, setFilterSort] = usePersistedState('filterSort', '');
  const [filterMap, setFilterMap] = usePersistedState('filterMap', false);

  const effectiveFleetTab = fleetWorkspaceMode === 'live' ? fleetTab : 'all';

  const deviceStats = useMemo(() => {
    const deviceList = Object.values(devices);
    const total = deviceList.length;
    const onlineList = deviceList.filter((d) => d.status === 'online');
    const offline = deviceList.filter((d) => d.status === 'offline').length;
    const positionList = Object.values(positions || {});
    const movingDeviceIds = new Set(
      positionList.filter((p) => Number(p.speed) > 0).map((p) => p.deviceId),
    );
    const moving = onlineList.filter((d) => movingDeviceIds.has(d.id)).length;
    const idling = onlineList.filter((d) => !movingDeviceIds.has(d.id)).length;

    return {
      total,
      online: onlineList.length,
      moving,
      idling,
      offline,
    };
  }, [devices, positions]);

  const alertDeviceIds = useMemo(() => {
    const s = new Set();
    allNotifications.forEach((n) => {
      if (n.read || n.archived) return;
      const id = n.metadata?.deviceId;
      if (id != null && id !== '') {
        const num = typeof id === 'number' ? id : Number(id);
        if (!Number.isNaN(num)) s.add(num);
      }
    });
    return s;
  }, [allNotifications]);

  const operationalPresence = useMemo(() => ({
    hasMoving: deviceStats.moving > 0,
    hasIdle: deviceStats.idling > 0,
    hasOffline: deviceStats.offline > 0,
    hasAlerts: alertDeviceIds.size > 0,
  }), [
    deviceStats.moving,
    deviceStats.idling,
    deviceStats.offline,
    alertDeviceIds,
  ]);

  useEffect(() => {
    const { hasMoving, hasIdle, hasOffline, hasAlerts } = operationalPresence;

    const invalid =
      (fleetTab === 'moving' && !hasMoving)
      || (fleetTab === 'idle' && !hasIdle)
      || (fleetTab === 'offline' && !hasOffline)
      || (fleetTab === 'alerts' && !hasAlerts)
      || fleetTab === 'online';

    if (invalid) {
      dispatch(fleetInteractionActions.setFleetTab('all'));
    }
  }, [fleetTab, operationalPresence, dispatch]);

  useFilter(
    searchQuery,
    filter,
    filterSort,
    filterMap,
    positions,
    setFilteredDevices,
    setFilteredPositions,
    effectiveFleetTab,
    alertDeviceIds,
  );

  const handleCloseSelection = useCallback(() => {
    dispatch(devicesActions.selectId(null));
  }, [dispatch]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (selectedDeviceId == null) return;
      dispatch(devicesActions.selectId(null));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dispatch, selectedDeviceId]);

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

  const sidebarFleetProps = useMemo(() => ({
    filteredDevices,
    positions,
    groups: Object.values(groups),
    filters: {
      statuses: filter.statuses,
      groups: filter.groups,
      sortBy: filterSort,
      mapOnly: filterMap,
    },
    operationalPresence,
    deviceFleetVehicleIdByDeviceId,
    effectiveFleetTab,
    onFilterChange: handlePremiumFilterChange,
  }), [
    filteredDevices,
    positions,
    groups,
    filter.statuses,
    filter.groups,
    filterSort,
    filterMap,
    operationalPresence,
    deviceFleetVehicleIdByDeviceId,
    effectiveFleetTab,
    handlePremiumFilterChange,
  ]);

  useLayoutEffect(() => {
    setLiveMapChrome({ sidebarFleetProps });
    return () => {
      setLiveMapChrome(null);
      setFleetSheetHeightCssVar(0);
    };
  }, [setLiveMapChrome, sidebarFleetProps]);

  const { phoneByDeviceId } = useDriverPhonesByDeviceId(
    sheetCommandEnabled && selectedDevice ? [selectedDevice] : [],
  );

  const selectedPhone = selectedDeviceId != null
    ? phoneByDeviceId[selectedDeviceId] ?? selectedDevice?.contact ?? selectedDevice?.phone ?? null
    : null;

  const mapColumn = (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      <MainMap
        filteredPositions={filteredPositions}
        selectedPosition={selectedPosition}
      />
      {sheetCommandEnabled && (
        <FleetCommandSheet
          devices={filteredDevices}
          positions={positions}
        />
      )}
      {sheetCommandEnabled && selectedDeviceId && selectedPosition && selectedDevice && (
        <VehicleContextCard
          device={selectedDevice}
          position={selectedPosition}
          fleetVehicleId={deviceFleetVehicleIdByDeviceId[Number(selectedDeviceId)]}
          phone={selectedPhone}
          onClose={handleCloseSelection}
        />
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {mapColumn}
    </Box>
  );
};

export default LiveMapPage;
