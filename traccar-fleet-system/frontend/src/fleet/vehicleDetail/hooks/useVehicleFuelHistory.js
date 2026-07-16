import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleFuelHistory } from '../../../operationSessions/api/operationSessionsApi.js';

export default function useVehicleFuelHistory(deviceId, limit = 5) {
  const user = useSelector((s) => s.session.user);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const numericDeviceId = deviceId != null ? Number(deviceId) : null;

  useEffect(() => {
    let cancelled = false;
    if (!user || numericDeviceId == null || !Number.isFinite(numericDeviceId)) {
      setHistory([]);
      return undefined;
    }
    setLoading(true);
    fetchVehicleFuelHistory(user, numericDeviceId, { limit })
      .then((data) => {
        if (cancelled) return;
        setHistory(Array.isArray(data?.history) ? data.history : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, numericDeviceId, limit]);

  return { loading, history };
}
