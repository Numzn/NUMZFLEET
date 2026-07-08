import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchVehicleOperationReports } from '../../../operationSessions/api/operationSessionsApi.js';

export default function useLastRefill(deviceId) {
  const user = useSelector((s) => s.session.user);
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const numericDeviceId = deviceId != null ? Number(deviceId) : null;

  useEffect(() => {
    let cancelled = false;
    if (!user || numericDeviceId == null || !Number.isFinite(numericDeviceId)) {
      setRow(null);
      return undefined;
    }
    setLoading(true);
    // Single request: the backend already filters to this vehicle's fueled
    // (actualFuelLitres > 0) refuels, sorted most-recent-first — no need to
    // fan out one request per historical session just to find the latest one.
    fetchVehicleOperationReports(user, { vehicleId: numericDeviceId, limit: 1 })
      .then((data) => {
        if (cancelled) return;
        setRow(data?.refuels?.[0] || null);
      })
      .catch(() => {
        if (!cancelled) setRow(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, numericDeviceId]);

  const lastRefill = useMemo(() => {
    if (!row) return null;
    return {
      session: {
        id: row.operationId,
        sessionDate: row.sessionDate,
        calendarDate: row.calendarDate,
      },
      refuel: {
        actualFuelLitres: row.actualLitres,
        odometerKm: row.odometerKm,
      },
    };
  }, [row]);

  return { loading, lastRefill };
}
