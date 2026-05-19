import { useCallback, useEffect, useState } from 'react';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';

/** Geofence entities linked to a Traccar device (same contract as DeviceConnections LinkField). */
export function useLinkedGeofences(deviceId) {
  const [linkedGeofences, setLinkedGeofences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reloadLinked = useCallback(async () => {
    if (deviceId == null) {
      setLinkedGeofences([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrThrow(traccarPath(`/api/geofences?deviceId=${deviceId}`));
      const rows = await res.json();
      setLinkedGeofences(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setLinkedGeofences([]);
      setError(e.message || 'Failed to load linked zones');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    reloadLinked();
  }, [reloadLinked]);

  return { linkedGeofences, reloadLinked, loading, error };
}
