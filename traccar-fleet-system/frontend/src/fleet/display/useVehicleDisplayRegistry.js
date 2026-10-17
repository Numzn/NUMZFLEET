import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useSelector } from 'react-redux';
import { useManager } from '../../common/util/permissions';
import { fetchVehicles } from '../vehiclesApi';
import useNotificationBridge from '../../notifications/useNotificationBridge';
import {
  buildVehicleDisplayRegistry,
  lookupVehicleDisplay,
} from './resolveVehicleDisplay';
import useMileageSignalRefresh from './useMileageSignalRefresh';

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
      markLoadedRef.current();
    } catch (e) {
      setError(e?.message || 'Failed to load vehicles');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [manager, user]);

  // Background refresh for live mileage: no loading flag, and a failed attempt keeps the rows already on
  // screen (an outage must not blank every card). fuel-api stays the only source of the numbers.
  const refreshSilently = useCallback(async () => {
    if (!manager || !user) return;
    try {
      const data = await fetchVehicles(user);
      if (Array.isArray(data)) {
        setRows(data);
        markLoadedRef.current();
      }
    } catch {
      // keep the last good rows; the next trigger retries
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

  // Live mileage: re-fetch the resolved values when the shared signal says they may have changed (a tracker's
  // counter advanced, the live connection came back, the tab was shown again, ...). See mileageSignal.js.
  const { markLoaded } = useMileageSignalRefresh(refreshSilently, { enabled: Boolean(manager && user) });
  // (the load callbacks above read this ref at call time; it cannot be declared before the hook that needs them)
  const markLoadedRef = useRef(markLoaded);
  markLoadedRef.current = markLoaded;

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
