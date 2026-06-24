import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleFuelStatistics } from '../../vehiclesApi.js';

export default function useVehicleFuelPerformance(fleetVehicleId) {
  const user = useSelector((s) => s.session.user);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!user || !fleetVehicleId) {
      setStats(null);
      setError(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVehicleFuelStatistics(user, fleetVehicleId);
      setStats(data);
      return data;
    } catch (err) {
      setStats(null);
      setError(err?.message || 'Failed to load fuel statistics');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, fleetVehicleId]);

  useEffect(() => {
    let cancelled = false;
    if (!user || !fleetVehicleId) {
      setStats(null);
      return undefined;
    }
    setLoading(true);
    setError(null);
    fetchVehicleFuelStatistics(user, fleetVehicleId)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setStats(null);
          setError(err?.message || 'Failed to load fuel statistics');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, fleetVehicleId]);

  return {
    loading,
    error,
    stats,
    fuelPerformance: stats?.fuelPerformance ?? null,
    reload,
  };
}
