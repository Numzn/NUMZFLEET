import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { traccarPath } from '../../../config/traccarApi.js';
import { fuelApiAuthHeaders } from '../../../config/fuelApiAuth.js';
import { invalidatePersonDriverLink } from '../../../common/util/usePersonDriverLinks';

/**
 * Every call the People and Drivers experience makes, in one place, so the
 * screens themselves never build a request path.
 *
 * Tenancy: the person resource itself (list/create/read/update/delete) is now
 * fully fuel-api-backed and company-scoped — see
 * fuel-api/src/modules/people/peopleService.js. Only drivers and the
 * driver↔person link still read and write Traccar globally, not scoped to
 * the caller's company — tracked for later migration the same way, and
 * deliberately unchanged in this pass (driver architecture is out of scope).
 */

/**
 * Company-scoped people list (GET /api/people). Returns the same
 * Traccar-shaped fields PeopleSection.jsx already renders (name, email, phone,
 * administrator, isManager, attributes, disabled, expirationTime, temporary),
 * pre-filtered server-side to the caller's own company — a Traccar user with
 * no numz_users row is omitted, not guessed into this company (see
 * fuel-api/src/modules/people/peopleService.js and
 * docs/TENANCY_ARCHITECTURE.md).
 */
export async function fetchCompanyPeople(user) {
  const response = await fetchOrThrow('/api/people', { headers: fuelApiAuthHeaders(user) });
  return response.json();
}

/** One company-scoped person (GET /api/people/:id) — 404s if owned by a different company. */
export async function fetchPerson(personId, user) {
  const response = await fetchOrThrow(`/api/people/${personId}`, { headers: fuelApiAuthHeaders(user) });
  return response.json();
}

/**
 * Creates a person: a Traccar account (so they can sign in) plus the
 * numz_users row that scopes them to the caller's own company, together —
 * see fuel-api/src/modules/people/peopleService.js's createCompanyPerson for
 * why this replaces the old two-step path (Traccar form, then wait for a
 * role assignment to incidentally provision numz_users).
 */
export async function createPerson({
  name, email, phone, password,
}, user) {
  const response = await fetchOrThrow('/api/people', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ name, email, phone, password }),
  });
  return response.json();
}

/**
 * Updates are whole-object replacements as far as the caller is concerned —
 * pass the record you loaded with your edits merged in. The backend (PATCH
 * /api/people/:id) only actually applies its own whitelisted subset of
 * fields and verifies company ownership first; anything else in the object
 * (id, temporary, ...) is safely ignored rather than acted on.
 */
export async function updatePerson(person, user) {
  const response = await fetchOrThrow(`/api/people/${person.id}`, {
    method: 'PATCH',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(person),
  });
  return response.json();
}

/** Deletes a company-owned person (DELETE /api/people/:id) — refused (409) if they're the company's last Company Admin. */
export async function deletePerson(personId, user) {
  await fetchOrThrow(`/api/people/${personId}`, {
    method: 'DELETE',
    headers: fuelApiAuthHeaders(user),
  });
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
