import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../../config/fuelApiAuth.js';

/**
 * Every call the People and Drivers experience makes, in one place, so the
 * screens themselves never build a request path.
 *
 * Tenancy: both People (fuel-api/src/modules/people/peopleService.js) and
 * Driver (fuel-api/src/modules/drivers/driverService.js) are now fully
 * fuel-api-backed and company-scoped. Nothing here calls Traccar directly —
 * Traccar is reached only from the backend's own integration boundary
 * (fuel-api/src/modules/drivers/driverTraccarSync.js), never the browser.
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

/**
 * Company-scoped drivers list (GET /api/drivers). Each row carries `personId`
 * (a Traccar user id, matching fetchCompanyPeople's own `id` field) when the
 * driver is linked to a person — resolving that link no longer costs a
 * separate request per person.
 */
export async function fetchCompanyDrivers(user) {
  const response = await fetchOrThrow('/api/drivers', { headers: fuelApiAuthHeaders(user) });
  return response.json();
}

/** One company-scoped driver (GET /api/drivers/:id) — 404s if owned by a different company. */
export async function fetchDriver(driverId, user) {
  const response = await fetchOrThrow(`/api/drivers/${driverId}`, { headers: fuelApiAuthHeaders(user) });
  return response.json();
}

/**
 * The vehicle(s) this driver is currently assigned to, per the authoritative
 * driver_assignments table (the same relationship Vehicle Setup's Driver
 * Assignment module writes to) — not derived from live Traccar telemetry.
 */
export async function fetchDriverVehicles(driverId, user) {
  const response = await fetchOrThrow(`/api/drivers/${driverId}/vehicles`, { headers: fuelApiAuthHeaders(user) });
  return response.json();
}

/**
 * A person's driver profile, if any — most people don't have one. There is
 * no dedicated endpoint for this direction; the company driver list already
 * carries personId per row (see fetchCompanyDrivers), so this is a client-side
 * lookup rather than a second request.
 */
export async function fetchDriverForPerson(personId, user) {
  const drivers = await fetchCompanyDrivers(user);
  return drivers.find((d) => String(d.personId) === String(personId)) ?? null;
}

/**
 * Creates a driver profile: a Traccar driver (so telemetry can identify
 * them) plus the NUMZFLEET record that owns the business relationship,
 * together — see fuel-api/src/modules/drivers/driverService.js.
 * `personId` (optional) links this driver to an existing person by their
 * Traccar id — a driver profile does not require a sign-in account.
 */
export async function createDriver({
  name, uniqueId, phone, personId = null,
}, user) {
  const response = await fetchOrThrow('/api/drivers', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ name, uniqueId, phone, personId }),
  });
  return response.json();
}

/**
 * Updates are whole-object replacements as far as the caller is concerned —
 * pass the record you loaded with your edits merged in. The backend (PATCH
 * /api/drivers/:id) only applies its own whitelisted subset of fields and
 * verifies company ownership first.
 */
export async function updateDriver(driver, user) {
  const response = await fetchOrThrow(`/api/drivers/${driver.id}`, {
    method: 'PATCH',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(driver),
  });
  return response.json();
}

/**
 * Deletes a company-owned driver (DELETE /api/drivers/:id) — refused (409)
 * if currently assigned to a vehicle; unassign first.
 */
export async function deleteDriver(driverId, user) {
  await fetchOrThrow(`/api/drivers/${driverId}`, {
    method: 'DELETE',
    headers: fuelApiAuthHeaders(user),
  });
}

/**
 * Assigns an existing NUMZFLEET driver to a vehicle (POST
 * /api/vehicles/:vehicleId/driver) — the authoritative Driver ↔ Vehicle
 * relationship. Refused (409) if the driver and vehicle belong to different
 * companies, even if both ids are otherwise valid.
 */
export async function assignVehicleDriver(vehicleId, driverId, user) {
  const response = await fetchOrThrow(`/api/vehicles/${vehicleId}/driver`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ driverId }),
  });
  return response.json();
}

/** Removes a vehicle's active driver assignment, if any (DELETE /api/vehicles/:vehicleId/driver). */
export async function unassignVehicleDriver(vehicleId, user) {
  const response = await fetchOrThrow(`/api/vehicles/${vehicleId}/driver`, {
    method: 'DELETE',
    headers: fuelApiAuthHeaders(user),
  });
  return response.json();
}
