import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleFuelStatistics } from '../../../operationSessions/api/operationSessionsApi.js';

export default function useVehicleFuelProfile(deviceId) {
  const user = useSelector((s) => s.session.user);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const numericDeviceId = deviceId != null ? Number(deviceId) : null;

  useEffect(() => {
    let cancelled = false;
    if (!user || numericDeviceId == null || !Number.isFinite(numericDeviceId)) {
      setProfile(null);
      return undefined;
    }
    setLoading(true);
    (async () => {
      try {
        const data = await fetchVehicleFuelStatistics(user, numericDeviceId);
        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, numericDeviceId]);

  return { loading, profile };
}
