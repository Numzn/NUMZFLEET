import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { traccarPath } from '../../../config/traccarApi.js';
import { invalidatePersonDriverLink } from '../../../common/util/usePersonDriverLinks';

/**
 * Every call the People and Drivers experience makes, in one place, so the
 * screens themselves never build a request path.
 *
 * Tenancy: these read and write globally, not scoped to the caller's company.
 * Pre-existing for this data, and tracked for the later migration behind
 * NUMZFLEET APIs — this module is the single seam where that will happen.
 */

export async function fetchPerson(personId) {
  const response = await fetchOrThrow(traccarPath(`/api/users/${personId}`));
  return response.json();
}

/**
 * Updates are whole-object replacements, so callers must pass the record they
 * loaded with their edits merged in — never a partial, or unsent fields are
 * cleared.
 */
export async function updatePerson(person) {
  const response = await fetchOrThrow(traccarPath(`/api/users/${person.id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  });
  return response.json();
}

export async function fetchDriverForPerson(personId) {
  const response = await fetchOrThrow(traccarPath(`/api/drivers?userId=${personId}`));
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function fetchDriver(driverId) {
  const response = await fetchOrThrow(traccarPath(`/api/drivers/${driverId}`));
  return response.json();
}

export async function updateDriver(driver) {
  const response = await fetchOrThrow(traccarPath(`/api/drivers/${driver.id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(driver),
  });
  return response.json();
}

/**
 * Removing a driver profile also drops its vehicle association — that happens
 * automatically and leaves no record, so anything asking the user to confirm
 * should say so.
 */
export async function deleteDriver(driverId) {
  await fetchOrThrow(traccarPath(`/api/drivers/${driverId}`), { method: 'DELETE' });
}

async function setDriverPersonLink(personId, driverId, linked) {
  await fetchOrThrow(traccarPath('/api/permissions'), {
    method: linked ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: Number(personId), driverId: Number(driverId) }),
  });
  invalidatePersonDriverLink(personId);
}

export { setDriverPersonLink };

/**
 * Creates a driver profile, optionally attached to the person it describes.
 *
 * Creating a record also attaches it to whoever created it. Left alone, every
 * driver a manager sets up would accumulate on that manager's own identity and
 * surface as their driver profile, so the creator is always detached — a driver
 * profile belongs to the person it describes, not to whoever entered it.
 */
export async function createDriver({
  name, uniqueId, phone, personId = null, actingUserId = null,
}) {
  const createResponse = await fetchOrThrow(traccarPath('/api/drivers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      uniqueId,
      attributes: phone ? { phone } : {},
    }),
  });
  const driver = await createResponse.json();

  if (personId != null) {
    await setDriverPersonLink(personId, driver.id, true);
  }

  if (actingUserId != null && Number(actingUserId) !== Number(personId)) {
    try {
      await setDriverPersonLink(actingUserId, driver.id, false);
    } catch {
      // The profile is created and correctly attached; a leftover link on the
      // creator is not worth failing the action for.
    }
  }

  return driver;
}
