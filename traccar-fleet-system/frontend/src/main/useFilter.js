import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { resolveLiveActivityState } from '../fleet/vehicleDetail/resolveLiveActivityState.js';

/**
 * @param {unknown} keyword
 * @param {object} filter
 * @param {string} filterSort
 * @param {boolean} filterMap
 * @param {Record<string|number, object>} positions
 * @param {function} setFilteredDevices
 * @param {function} setFilteredPositions
 * @param {'all'|'online'|'offline'|'moving'|'idle'|'alerts'} [fleetTab]
 * @param {Set<number>|undefined} [alertDeviceIds] device ids referenced by unread notifications
 */
export default (
  keyword,
  filter,
  filterSort,
  filterMap,
  positions,
  setFilteredDevices,
  setFilteredPositions,
  fleetTab = 'all',
  alertDeviceIds,
) => {
  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);

  const safeKeyword = String(keyword ?? '').toLowerCase();
  const safePositions = positions ?? {};

  const positionArray = useMemo(() => Object.values(safePositions), [safePositions]);

  useEffect(() => {
    const deviceGroups = (device) => {
      const groupIds = [];
      let { groupId } = device;
      while (groupId) {
        groupIds.push(groupId);
        groupId = groups[groupId]?.groupId || 0;
      }
      return groupIds;
    };

    // Same live authority as the rest of the fleet UI (see
    // resolveLiveActivityState.js) — one evaluation timestamp per filter
    // pass so every device in this pass is judged consistently.
    const now = Date.now();
    const fleetTabFilters = (device) => {
      if (fleetTab === 'alerts') {
        if (!alertDeviceIds || alertDeviceIds.size === 0) return false;
        const idNum = Number(device.id);
        return alertDeviceIds.has(device.id) || alertDeviceIds.has(idNum);
      }
      if (fleetTab !== 'online' && fleetTab !== 'offline' && fleetTab !== 'moving' && fleetTab !== 'idle') {
        return true;
      }
      const p = safePositions[device.id];
      const state = resolveLiveActivityState({
        deviceStatus: device.status,
        deviceLastUpdate: device.lastUpdate,
        positionSpeed: p?.speed != null ? Number(p.speed) : null,
        now,
      });
      switch (fleetTab) {
        case 'online':
          return state !== 'offline';
        case 'offline':
          return state === 'offline';
        case 'moving':
          return state === 'moving';
        case 'idle':
          return state === 'idle';
        default:
          return true;
      }
    };

    const filtered = Object.values(devices)
      .filter((device) => !filter.statuses.length || filter.statuses.includes(device.status))
      .filter((device) => !filter.groups.length || deviceGroups(device).some((id) => filter.groups.includes(id)))
      .filter(fleetTabFilters)
      .filter((device) => {
        if (!safeKeyword) return true;
        return [device.name, device.uniqueId, device.phone, device.model, device.contact].some(
          (s) => s && String(s).toLowerCase().includes(safeKeyword),
        );
      });
    switch (filterSort) {
      case 'name':
        filtered.sort((device1, device2) => device1.name.localeCompare(device2.name));
        break;
      case 'lastUpdate':
        filtered.sort((device1, device2) => {
          const time1 = device1.lastUpdate ? dayjs(device1.lastUpdate).valueOf() : 0;
          const time2 = device2.lastUpdate ? dayjs(device2.lastUpdate).valueOf() : 0;
          return time2 - time1;
        });
        break;
      default:
        break;
    }
    setFilteredDevices(filtered);
    setFilteredPositions(filterMap
      ? filtered.map((device) => safePositions[device.id]).filter(Boolean)
      : positionArray);
  }, [
    safeKeyword,
    filter,
    filterSort,
    filterMap,
    fleetTab,
    alertDeviceIds,
    groups,
    devices,
    safePositions,
    positionArray,
    setFilteredDevices,
    setFilteredPositions,
  ]);
};
