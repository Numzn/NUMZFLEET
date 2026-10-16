import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useSelector, useStore } from 'react-redux';
import { useManager } from '../../common/util/permissions';
import { fetchVehicles } from '../vehiclesApi';
import useNotificationBridge from '../../notifications/useNotificationBridge';
import {
  buildVehicleDisplayRegistry,
  lookupVehicleDisplay,
} from './resolveVehicleDisplay';
import {
  mileageFingerprint,
  nextRefreshDelay,
  shouldRefreshOnVisible,
} from './registryRefreshPolicy';

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
  const store = useStore();
  const lastLoadedAtRef = useRef(0);

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
      lastLoadedAtRef.current = Date.now();
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
        lastLoadedAtRef.current = Date.now();
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

  // Live mileage. The Redux store already receives every tracker position over the existing socket; when a
  // counter advances, ask fuel-api for the resolved values again (debounced, rate-limited). Subscribing to
  // the store directly keeps this provider from re-rendering on every position update. A tab that was
  // hidden catches up when it becomes visible.
  useEffect(() => {
    if (!manager || !user) return undefined;
    let timer = null;
    let skippedWhileHidden = false;
    let lastPositions = null;
    let fingerprint = mileageFingerprint(store.getState().session.positions);

    const fire = () => {
      timer = null;
      if (document.visibilityState === 'hidden') {
        skippedWhileHidden = true;
        return;
      }
      refreshSilently();
    };

    const unsubscribe = store.subscribe(() => {
      const { positions } = store.getState().session;
      if (positions === lastPositions) return;
      lastPositions = positions;
      const next = mileageFingerprint(positions);
      if (next === fingerprint) return;
      const wasEmpty = fingerprint === '';
      fingerprint = next;
      // The first positions after load are the baseline the registry fetch already reflects.
      if (wasEmpty || timer != null) return;
      timer = window.setTimeout(fire, nextRefreshDelay({ lastLoadedAt: lastLoadedAtRef.current, now: Date.now() }));
    });

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (skippedWhileHidden || shouldRefreshOnVisible({ lastLoadedAt: lastLoadedAtRef.current, now: Date.now() })) {
        skippedWhileHidden = false;
        refreshSilently();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [manager, user, store, refreshSilently]);

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
