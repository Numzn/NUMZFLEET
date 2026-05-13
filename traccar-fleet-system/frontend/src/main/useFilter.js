import { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';

export default (keyword, filter, filterSort, filterMap, positions, setFilteredDevices, setFilteredPositions, fleetTab = 'all') => {
  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);

  const safeKeyword = String(keyword ?? '').toLowerCase();
  const safePositions = positions ?? {};

  // Memoize position array conversion for better performance
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

    const filtered = Object.values(devices)
      .filter((device) => !filter.statuses.length || filter.statuses.includes(device.status))
      .filter((device) => !filter.groups.length || deviceGroups(device).some((id) => filter.groups.includes(id)))
      .filter((device) => {
        switch (fleetTab) {
          case 'online':
            return device.status === 'online';
          case 'offline':
            return device.status === 'offline';
          case 'moving': {
            const p = safePositions[device.id];
            return Boolean(p && Number(p.speed) > 0);
          }
          default:
            return true;
        }
      })
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
      : positionArray); // Use memoized array
  }, [safeKeyword, filter, filterSort, filterMap, fleetTab, groups, devices, safePositions, positionArray, setFilteredDevices, setFilteredPositions]);
};
