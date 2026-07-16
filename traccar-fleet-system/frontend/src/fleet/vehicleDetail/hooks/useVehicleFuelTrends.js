import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleFuelTrends } from '../../../operationSessions/api/operationSessionsApi.js';

export default function useVehicleFuelTrends(deviceId) {
  const user = useSelector((s) => s.session.user);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);
  const numericDeviceId = deviceId != null ? Number(deviceId) : null;

  useEffect(() => {
    let cancelled = false;
    if (!user || numericDeviceId == null || !Number.isFinite(numericDeviceId)) {
      setTrends(null);
      return undefined;
    }
    setLoading(true);
    fetchVehicleFuelTrends(user, numericDeviceId)
      .then((data) => {
        if (cancelled) return;
        setTrends(data || null);
      })
      .catch(() => {
        if (!cancelled) setTrends(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, numericDeviceId]);

  return { loading, trends };
}
