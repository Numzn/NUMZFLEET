/**
 * Company-scoped device mutations, through fuel-api.
 *
 * Creating a device already goes through POST /api/fleet/devices (see DevicePage).
 * Editing and removing do too: fuel-api checks the caller's company before it
 * touches Traccar, and keeps NUMZFLEET's own ownership and assignment records in
 * step. The browser never edits or deletes a tracker directly in Traccar.
 */
import fetchOrThrow from '../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../config/fuelApiAuth.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Fields a fleet manager may change on a tracker. Everything else is platform-managed. */
export const EDITABLE_DEVICE_FIELDS = ['name', 'phone', 'model', 'category'];

/** The caller's company's trackers and their latest positions — { devices, positions }. */
export async function fetchFleetDeviceSnapshot(user) {
  const response = await fetchOrThrow('/api/fleet/devices', { headers: fuelApiAuthHeaders(user) });
  return response.json();
}

export async function updateFleetDevice(user, deviceId, patch) {
  const body = {};
  EDITABLE_DEVICE_FIELDS.forEach((field) => {
    if (field in patch) body[field] = patch[field];
  });
  const response = await fetchOrThrow(`/api/fleet/devices/${encodeURIComponent(deviceId)}`, {
    method: 'PATCH',
    headers: { ...fuelApiAuthHeaders(user), ...JSON_HEADERS },
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function deleteFleetDevice(user, deviceId) {
  await fetchOrThrow(`/api/fleet/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: fuelApiAuthHeaders(user),
  });
}
