import { useMemo } from 'react';
import { useSelector } from 'react-redux';

const PENDING_STATUSES = new Set(['pending', 'submitted', 'awaiting_approval', 'awaiting approval']);

function matchesDevice(request, deviceId) {
  if (deviceId == null) return false;
  return Number(request.deviceId) === Number(deviceId);
}

/**
 * Fuel requests for a Traccar device from Redux cache.
 */
export default function useVehicleFuelRequests(deviceId) {
  const items = useSelector((s) => s.fuelRequests?.items || {});

  return useMemo(() => {
    const all = Object.values(items).filter((r) => matchesDevice(r, deviceId));
    const pending = all.filter((r) => PENDING_STATUSES.has(String(r.status || '').toLowerCase()));
    const recent = [...all]
      .sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, 5);
    const lastApproved = all.find((r) => String(r.status).toLowerCase() === 'approved')
      || all.find((r) => String(r.status).toLowerCase() === 'fulfilled');

    return {
      pending,
      pendingCount: pending.length,
      recent,
      lastApproved,
      hasHistory: recent.length > 0,
    };
  }, [items, deviceId]);
}
