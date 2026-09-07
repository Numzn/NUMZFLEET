import { useMemo, useState } from 'react';
import fetchOrThrow from './fetchOrThrow';
import { traccarPath } from '../../config/traccarApi.js';
import usePersonDriverLinks from './usePersonDriverLinks';
import { useEffectAsync } from '../../reactHelper';

/**
 * Which person, if any, each driver profile belongs to.
 *
 * The relationship can only be read in one direction — "which driver profiles
 * does this person have". Asking the other way is accepted and silently
 * ignored, returning an unfiltered list (verified: a driver id that does not
 * exist returns exactly the same result as a real one), so it cannot be used.
 * The mapping is therefore built by asking per person and inverting the answer,
 * reusing the same cache the People list fills.
 */
export default function useDriverPersonIndex({ enabled = true } = {}) {
  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(enabled);

  useEffectAsync(async () => {
    if (!enabled) {
      setLoadingPeople(false);
      return null;
    }
    setLoadingPeople(true);
    try {
      const response = await fetchOrThrow(traccarPath('/api/users'));
      setPeople(await response.json());
    } catch {
      setPeople([]);
    } finally {
      setLoadingPeople(false);
    }
    return null;
  }, [enabled]);

  const { driverByPerson, loading: loadingLinks } = usePersonDriverLinks(people.map((p) => p.id));

  const personByDriverId = useMemo(() => {
    const index = {};
    people.forEach((person) => {
      const driver = driverByPerson[person.id];
      if (driver) index[driver.id] = person;
    });
    return index;
  }, [people, driverByPerson]);

  return { personByDriverId, people, loading: loadingPeople || loadingLinks };
}
