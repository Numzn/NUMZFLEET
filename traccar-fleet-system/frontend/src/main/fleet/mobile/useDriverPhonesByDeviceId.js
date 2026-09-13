import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../../config/fuelApiAuth.js';

/** Session cache: deviceId -> phone string (or null when looked up but absent). */
const phoneCache = new Map();

/**
 * fuel-api's own company-scoped resolver (device -> vehicle -> assigned
 * NUMZFLEET driver -> phone), not Traccar's native /api/drivers?deviceId=
 * list — that endpoint has no company column, so any signed-in user could
 * previously resolve any other company's driver phone by device id.
 */
async function fetchDriverPhone(deviceId, user) {
  try {
    const res = await fetchOrThrow(`/api/vehicles/device/${deviceId}/driver-phone`, {
      headers: fuelApiAuthHeaders(user),
    });
    const { phone } = await res.json();
    phoneCache.set(deviceId, phone ?? null);
    return phone ?? null;
  } catch {
    phoneCache.set(deviceId, null);
    return null;
  }
}

/**
 * Resolve linked-driver phone numbers for a set of devices, used by the mobile
 * fleet cards' "Call Driver" action. Results are cached for the session so the
 * lookup runs once per device.
 * @param {Array<{id: number|string}>} devices
 * @returns {{ phoneByDeviceId: Record<string|number, string|null>, loading: boolean }}
 */
export default function useDriverPhonesByDeviceId(devices = []) {
  const user = useSelector((state) => state.session.user);
  const [phoneByDeviceId, setPhoneByDeviceId] = useState({});
  const [loading, setLoading] = useState(false);

  const ids = devices.map((d) => d.id).filter((id) => id != null);
  const idsKey = ids.join(',');

  useEffect(() => {
    let cancelled = false;
    const missing = ids.filter((id) => !phoneCache.has(id));

    // Seed from cache immediately so re-renders keep known phones.
    setPhoneByDeviceId((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (phoneCache.has(id)) next[id] = phoneCache.get(id);
      });
      return next;
    });

    if (missing.length === 0 || !user) return undefined;

    setLoading(true);
    Promise.all(missing.map((id) => fetchDriverPhone(id, user).then((phone) => [id, phone])))
      .then((entries) => {
        if (cancelled) return;
        setPhoneByDeviceId((prev) => {
          const next = { ...prev };
          entries.forEach(([id, phone]) => { next[id] = phone; });
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [idsKey, user]);

  return { phoneByDeviceId, loading };
}
