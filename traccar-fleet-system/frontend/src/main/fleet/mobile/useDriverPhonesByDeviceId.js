import { useEffect, useState } from 'react';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { traccarPath } from '../../../config/traccarApi.js';

/** Session cache: deviceId -> phone string (or null when looked up but absent). */
const phoneCache = new Map();

async function fetchDriverPhone(deviceId) {
  try {
    const res = await fetchOrThrow(traccarPath(`/api/drivers?deviceId=${deviceId}`));
    const rows = await res.json();
    const phone = Array.isArray(rows)
      ? rows.map((d) => d?.attributes?.phone).find(Boolean) || null
      : null;
    phoneCache.set(deviceId, phone);
    return phone;
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

    if (missing.length === 0) return undefined;

    setLoading(true);
    Promise.all(missing.map((id) => fetchDriverPhone(id).then((phone) => [id, phone])))
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
  }, [idsKey]);

  return { phoneByDeviceId, loading };
}
