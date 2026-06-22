import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchOperationSessionDetails, fetchOperationSessions } from '../../../operationSessions/api/operationSessionsApi.js';

const CLOSED_DETAILS_LIMIT = 15;

function sessionSortKey(session) {
  const t = new Date(session?.calendarDate || session?.sessionDate || session?.updatedAt || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function matchesDevice(refuelVehicleId, deviceId) {
  if (deviceId == null || !Number.isFinite(Number(deviceId))) return false;
  return Number(refuelVehicleId) === Number(deviceId);
}

export default function useLastRefill(deviceId) {
  const user = useSelector((s) => s.session.user);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const numericDeviceId = deviceId != null ? Number(deviceId) : null;

  useEffect(() => {
    let cancelled = false;
    if (!user || numericDeviceId == null || !Number.isFinite(numericDeviceId)) {
      setSessions([]);
      return undefined;
    }
    setLoading(true);
    (async () => {
      try {
        const raw = await fetchOperationSessions(user);
        const list = Array.isArray(raw) ? raw : [];
        const locked = list
          .filter((s) => String(s.effectiveStatus || s.status).toLowerCase() === 'locked')
          .sort((a, b) => sessionSortKey(b) - sessionSortKey(a))
          .slice(0, CLOSED_DETAILS_LIMIT);

        const withDetails = await Promise.all(
          locked.map(async (s) => {
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
  }, [user, numericDeviceId]);

  const lastRefill = useMemo(() => {
    let best = null;
    for (const session of sessions) {
      for (const r of session?.refuels || []) {
        if (!matchesDevice(r.vehicleId, numericDeviceId)) continue;
        const actual = r.actualFuelLitres != null ? Number(r.actualFuelLitres) : null;
        if (actual == null || actual <= 0) continue;
        const sessionTime = sessionSortKey(session);
        const lastTime = best ? sessionSortKey(best.session) : 0;
        if (!best || sessionTime > lastTime) {
          best = { session, refuel: r };
        }
      }
    }
    return best;
  }, [sessions, numericDeviceId]);

  return { loading, lastRefill };
}
