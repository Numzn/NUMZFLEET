import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchOperationSessions, fetchOperationSessionDetails } from '../../../operationSessions/api/operationSessionsApi.js';

/**
 * Operation session refuel context for a fleet vehicle (numeric vehicle id).
 */
export default function useVehicleOperationContext(fleetVehicleId) {
  const user = useSelector((s) => s.session.user);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  const numericVehicleId = fleetVehicleId != null ? Number(fleetVehicleId) : null;
  const matchVehicleId = (refuelVehicleId) => {
    if (numericVehicleId == null || !Number.isFinite(numericVehicleId)) {
      return String(refuelVehicleId) === String(fleetVehicleId);
    }
    return Number(refuelVehicleId) === numericVehicleId;
  };

  useEffect(() => {
    let cancelled = false;
    if (!user || fleetVehicleId == null || fleetVehicleId === '') {
      setSessions([]);
      return undefined;
    }
    setLoading(true);
    (async () => {
      try {
        const list = await fetchOperationSessions(user);
        if (cancelled) return;
        const active = (Array.isArray(list) ? list : []).filter(
          (s) => String(s.status).toLowerCase() !== 'closed',
        );
        const withDetails = await Promise.all(
          active.slice(0, 3).map(async (s) => {
            try {
              return await fetchOperationSessionDetails(user, s.id);
            } catch {
              return s;
            }
          }),
        );
        if (!cancelled) setSessions(withDetails);
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, fleetVehicleId]);

  return useMemo(() => {
    let activeRefuel = null;
    let lastRefill = null;

    for (const session of sessions) {
      const refuels = session?.refuels || [];
      const row = refuels.find((r) => matchVehicleId(r.vehicleId));
      if (row) {
        activeRefuel = { session, refuel: row };
        break;
      }
    }

    for (const session of sessions) {
      const refuels = session?.refuels || [];
      for (const r of refuels) {
        if (!matchVehicleId(r.vehicleId)) continue;
        const actual = r.actualFuelLitres != null ? Number(r.actualFuelLitres) : null;
        if (actual != null && actual > 0) {
          if (!lastRefill || new Date(session.sessionDate || 0) > new Date(lastRefill.sessionDate || 0)) {
            lastRefill = { session, refuel: r };
          }
        }
      }
    }

    return {
      loading,
      activeRefuel,
      lastRefill,
      hasOperationData: Boolean(activeRefuel || lastRefill),
    };
  }, [sessions, fleetVehicleId, loading, numericVehicleId]);
}
