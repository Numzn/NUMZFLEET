import { useEffect, useState } from 'react';
import fetchOrThrow from './fetchOrThrow';
import useFeatures from './useFeatures';
import { traccarPath } from '../../config/traccarApi.js';

/**
 * Resolves which people have a driver profile.
 *
 * There is no bulk endpoint for this relationship — it can only be read one
 * person at a time — so this follows the same shape as
 * main/fleet/mobile/useDriverPhonesByDeviceId.js: one request per uncached
 * person, run in parallel, cached for the session.
 */

/** personId -> driver profile, or null once looked up and found absent. */
const driverByPersonId = new Map();

/**
 * Drops a cached answer after a driver profile is created or removed, so the
 * People list stops showing a stale indicator for that person.
 */
export function invalidatePersonDriverLink(personId) {
  driverByPersonId.delete(personId);
  driverByPersonId.delete(Number(personId));
  driverByPersonId.delete(String(personId));
}

async function fetchDriverForPerson(personId) {
  try {
    const response = await fetchOrThrow(traccarPath(`/api/drivers?userId=${personId}`));
    const rows = await response.json();
    // A person has at most one driver profile in NUMZFLEET's model, even though
    // the underlying link is many-to-many.
    const driver = Array.isArray(rows) ? rows[0] || null : null;
    driverByPersonId.set(personId, driver);
    return driver;
  } catch {
    driverByPersonId.set(personId, null);
    return null;
  }
}

export default function usePersonDriverLinks(personIds = []) {
  const { disableDrivers } = useFeatures();
  const [driverByPerson, setDriverByPerson] = useState({});
  const [loading, setLoading] = useState(false);

  const ids = personIds.filter((id) => id != null);
  const idsKey = ids.join(',');

  useEffect(() => {
    if (disableDrivers) return undefined;

    let cancelled = false;
    const missing = ids.filter((id) => !driverByPersonId.has(id));

    // Seed from cache, but only when it actually adds something — returning a
    // fresh object unconditionally would re-render on every run for no reason.
    const cached = ids.filter((id) => driverByPersonId.has(id));
    if (cached.length) {
      setDriverByPerson((prev) => {
        const missingFromState = cached.filter((id) => !(id in prev));
        if (!missingFromState.length) return prev;
        const next = { ...prev };
        missingFromState.forEach((id) => { next[id] = driverByPersonId.get(id); });
        return next;
      });
    }

    if (missing.length === 0) return undefined;

    setLoading(true);
    Promise.all(missing.map((id) => fetchDriverForPerson(id).then((driver) => [id, driver])))
      .then((entries) => {
        if (cancelled) return;
        setDriverByPerson((prev) => {
          const next = { ...prev };
          entries.forEach(([id, driver]) => { next[id] = driver; });
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [idsKey, disableDrivers]);

  return { driverByPerson, loading };
}
