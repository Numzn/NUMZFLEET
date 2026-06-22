import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  fetchVehicleServiceRecords,
  fuelApiErrorMessage,
} from '../../vehiclesApi.js';

export default function useVehicleServiceHistory(fleetVehicleId) {
  const user = useSelector((state) => state.session.user);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!fleetVehicleId || !user) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVehicleServiceRecords(user, fleetVehicleId);
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(fuelApiErrorMessage(e, 'Failed to load service history'));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fleetVehicleId, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { records, loading, error, reload };
}
