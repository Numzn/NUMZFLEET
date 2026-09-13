import { useMemo, useState } from 'react';
import { fetchCompanyPeople, fetchCompanyDrivers } from '../../settings/center/people/personApi';
import { useEffectAsync } from '../../reactHelper';

/**
 * Which person, if any, each driver profile belongs to — and the caller's
 * own company People, for driver-creation Autocomplete pickers.
 *
 * Both come from a single company-scoped fetch each now (GET /api/people,
 * GET /api/drivers) — the driver row already carries `personId` (a Traccar
 * id, matching fetchCompanyPeople's own `id`), so no per-person lookup is
 * needed the way the old Traccar-direct version required.
 */
export default function useDriverPersonIndex({ enabled = true, currentUser } = {}) {
  const [people, setPeople] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(enabled);

  useEffectAsync(async () => {
    if (!enabled) {
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const [peopleResult, driversResult] = await Promise.all([
        fetchCompanyPeople(currentUser),
        fetchCompanyDrivers(currentUser),
      ]);
      setPeople(Array.isArray(peopleResult) ? peopleResult : []);
      setDrivers(Array.isArray(driversResult) ? driversResult : []);
    } catch {
      setPeople([]);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
    return null;
  }, [enabled, currentUser]);

  const personByDriverId = useMemo(() => {
    const peopleById = new Map(people.map((p) => [String(p.id), p]));
    const index = {};
    drivers.forEach((driver) => {
      if (driver.personId == null) return;
      const person = peopleById.get(String(driver.personId));
      if (person) index[driver.id] = person;
    });
    return index;
  }, [people, drivers]);

  /** People with no driver profile yet — the only ones eligible to link when adding a new driver. */
  const unlinkedPeople = useMemo(() => {
    const linkedPersonIds = new Set(
      drivers.map((d) => d.personId).filter((id) => id != null).map(String),
    );
    return people.filter((p) => !linkedPersonIds.has(String(p.id)));
  }, [people, drivers]);

  return {
    personByDriverId, people, unlinkedPeople, drivers, loading,
  };
}
