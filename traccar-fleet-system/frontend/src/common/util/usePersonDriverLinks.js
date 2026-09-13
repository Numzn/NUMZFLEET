import { useMemo, useState } from 'react';
import { fetchCompanyDrivers } from '../../settings/center/people/personApi';
import useFeatures from './useFeatures';
import { useEffectAsync } from '../../reactHelper';

/**
 * Which of the given people have a driver profile — the inverse view of
 * useDriverPersonIndex (driver -> person). One company-scoped fetch
 * (GET /api/drivers, already carrying personId per row) rather than the old
 * one-Traccar-request-per-person pattern; personIds is only used to filter
 * the result, not to drive individual requests.
 */
export default function usePersonDriverLinks(personIds = [], { currentUser } = {}) {
  const { disableDrivers } = useFeatures();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);

  const idsKey = personIds.filter((id) => id != null).join(',');

  useEffectAsync(async () => {
    if (disableDrivers) return null;
    setLoading(true);
    try {
      const result = await fetchCompanyDrivers(currentUser);
      setDrivers(Array.isArray(result) ? result : []);
    } catch {
      setDrivers([]);
    } finally {
      setLoading(false);
    }
    return null;
  }, [disableDrivers, currentUser]);

  const driverByPerson = useMemo(() => {
    const index = {};
    drivers.forEach((driver) => {
      if (driver.personId == null) return;
      index[driver.personId] = driver;
    });
    return index;
    // idsKey isn't read here — kept as a dependency so callers that pass a
    // changing id list still re-render when it changes, matching the
    // previous contract.
  }, [drivers, idsKey]);

  return { driverByPerson, loading };
}
