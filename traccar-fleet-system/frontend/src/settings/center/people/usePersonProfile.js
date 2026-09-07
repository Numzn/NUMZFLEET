import { useCallback, useState } from 'react';
import { useEffectAsync } from '../../../reactHelper';
import { fetchPerson, fetchDriverForPerson, fetchDriver } from './personApi';

/**
 * Loads the records that make up one person, from whichever end the caller
 * arrived by — their account (People) or their driver profile (Drivers) — so
 * both entry points feed the same screen instead of each fetching its own copy.
 */
export default function usePersonProfile({ personId, driverId }) {
  const [person, setPerson] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timestamp, setTimestamp] = useState(Date.now());

  const reload = useCallback(() => setTimestamp(Date.now()), []);

  useEffectAsync(async () => {
    if (!personId && !driverId) return null;
    setLoading(true);
    setError(null);
    try {
      if (personId) {
        setPerson(await fetchPerson(personId));
        // A missing driver profile is a normal state, not a failure — most
        // people do not have one.
        try {
          setDriver(await fetchDriverForPerson(personId));
        } catch {
          setDriver(null);
        }
      } else {
        setPerson(null);
        setDriver(await fetchDriver(driverId));
      }
    } catch (e) {
      setError(e.message || 'This record could not be loaded.');
    } finally {
      setLoading(false);
    }
    return null;
  }, [personId, driverId, timestamp]);

  return {
    person, driver, loading, error, reload,
  };
}
