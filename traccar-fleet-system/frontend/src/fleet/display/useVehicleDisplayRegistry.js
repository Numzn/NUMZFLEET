import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useManager } from '../../common/util/permissions';
import { fetchVehicles } from '../vehiclesApi';
import useNotificationBridge from '../../notifications/useNotificationBridge';
import {
  buildVehicleDisplayRegistry,
  lookupVehicleDisplay,
} from './resolveVehicleDisplay';

const isAssignmentNotification = (n) => n.entityType === 'assignment';

/**
 * Loads fleet vehicles and exposes display registry keyed by Traccar deviceId.
 */
export default function useVehicleDisplayRegistry() {
  const manager = useManager();
  const user = useSelector((state) => state.session.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!manager || !user) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVehicles(user);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Failed to load vehicles');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [manager, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onFleetVehiclesChanged = () => {
      reload();
    };
    window.addEventListener('numz:fleet-vehicles-changed', onFleetVehiclesChanged);
    return () => window.removeEventListener('numz:fleet-vehicles-changed', onFleetVehiclesChanged);
  }, [reload]);

  useNotificationBridge(isAssignmentNotification, reload);

  const { byDeviceId, byFleetVehicleId } = useMemo(
    () => buildVehicleDisplayRegistry(rows),
    [rows],
  );

  const getDisplayForDevice = useCallback(
    (deviceId, device) => lookupVehicleDisplay(byDeviceId, deviceId, device),
    [byDeviceId],
  );

  const fleetVehicleIdByDeviceId = useMemo(() => {
    const m = {};
    byDeviceId.forEach((display, deviceId) => {
      if (display.fleetVehicleId) m[deviceId] = display.fleetVehicleId;
    });
    return m;
  }, [byDeviceId]);

  return {
    rows,
    loading,
    error,
    reload,
    byDeviceId,
    byFleetVehicleId,
    fleetVehicleIdByDeviceId,
    getDisplayForDevice,
  };
}
