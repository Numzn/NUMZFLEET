import { useEffect, useState } from 'react';
import fetchOrThrow from '../../../common/util/fetchOrThrow.js';
import { traccarPath } from '../../../config/traccarApi.js';

export default function useVehicleTodayTrips(deviceId) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deviceId == null) {
      setTrips([]);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const to = now.toISOString();
      const query = new URLSearchParams({ from, to, deviceId: String(deviceId) });
      try {
        const res = await fetchOrThrow(`${traccarPath('/api/reports/trips')}?${query}`, {
          headers: { Accept: 'application/json' },
        });
        const rows = await res.json();
        if (!cancelled) setTrips(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setTrips([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  return { trips, loading };
}
