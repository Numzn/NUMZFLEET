import { traccarServiceFetch } from '../../services/traccarServiceClient.js';

/**
 * The Driver ↔ Traccar integration boundary. NUMZFLEET's `drivers` table is
 * the business identity; everything in this file is a synchronized
 * *projection* onto Traccar (tc_drivers / tc_user_driver / tc_device_driver),
 * kept for telemetry and Traccar-native reporting. Nothing outside
 * driverService.js/vehicleFleetService.js should import this file directly —
 * business logic (ownership, tenancy, validation) lives in those, not here.
 *
 * Traccar creation is synchronous on driver create (mirrors
 * peopleService.js's createCompanyPerson: a NUMZFLEET driver without a
 * working Traccar projection can't identify itself to telemetry, so it isn't
 * a soft failure). Every other sync here is best-effort — a Traccar hiccup
 * must not fail an already-committed NUMZFLEET write, matching
 * companyProvisioningService.js's reconcileCompanyTraccarUsers.
 */

/**
 * org.traccar.model.Driver (Traccar's own model — not ours to change) has
 * exactly four fields: id, name, uniqueId, attributes. Confirmed against the
 * live tc_drivers schema this session (id, name, uniqueid, attributes — no
 * phone column). `attributes` is Traccar's own open Map<String,Object>,
 * which is where NUMZFLEET's Driver-only fields (currently just `phone`)
 * belong — the exact same place `attributes.isManager`/`attributes.phone`
 * already land for Traccar *users* elsewhere in this codebase. This
 * function builds its Traccar-bound body from that explicit allowlist only
 * — a caller passing any other field (phone included) can never leak it to
 * a top-level key, because nothing here ever spreads the input object.
 */
export function toTraccarDriverBody({ name, uniqueId, phone }) {
  return {
    name,
    uniqueId,
    attributes: phone ? { phone } : {},
  };
}

export async function createTraccarDriver({ name, uniqueId, phone }) {
  return traccarServiceFetch('/api/drivers', {
    method: 'POST',
    body: JSON.stringify(toTraccarDriverBody({ name, uniqueId, phone })),
  });
}

export async function updateTraccarDriver(traccarDriverId, { name, uniqueId, phone }) {
  return traccarServiceFetch(`/api/drivers/${traccarDriverId}`, {
    method: 'PUT',
    body: JSON.stringify({ id: traccarDriverId, ...toTraccarDriverBody({ name, uniqueId, phone }) }),
  });
}

export async function deleteTraccarDriver(traccarDriverId) {
  return traccarServiceFetch(`/api/drivers/${traccarDriverId}`, { method: 'DELETE' });
}

/** Best-effort tc_user_driver projection — never blocks the NUMZFLEET write. */
export async function syncPersonDriverLink(traccarUserId, traccarDriverId, linked) {
  if (traccarUserId == null || traccarDriverId == null) return;
  try {
    await traccarServiceFetch('/api/permissions', {
      method: linked ? 'POST' : 'DELETE',
      body: JSON.stringify({ userId: Number(traccarUserId), driverId: Number(traccarDriverId) }),
    });
  } catch (err) {
    console.warn('[driverTraccarSync] person-driver link sync failed (non-fatal):', err?.message || err);
  }
}

/** Best-effort tc_device_driver projection — never blocks the NUMZFLEET write. */
export async function syncDeviceDriverLink(traccarDeviceId, traccarDriverId, linked) {
  if (traccarDeviceId == null || traccarDriverId == null) return;
  try {
    await traccarServiceFetch('/api/permissions', {
      method: linked ? 'POST' : 'DELETE',
      body: JSON.stringify({ deviceId: Number(traccarDeviceId), driverId: Number(traccarDriverId) }),
    });
  } catch (err) {
    console.warn('[driverTraccarSync] device-driver link sync failed (non-fatal):', err?.message || err);
  }
}
