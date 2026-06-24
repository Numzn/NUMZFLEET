/**
 * Fleet vehicles (fuel-api / Postgres + Traccar merge). Same auth as fuel-requests / vehicle-specs.
 */
import fetchOrThrow from '../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../config/fuelApiAuth.js';

export async function fetchVehicles(user) {
  const res = await fetchOrThrow('/api/vehicles', {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function createVehicle(user, { name, plateNumber }) {
  const res = await fetchOrThrow('/api/vehicles', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({
      name,
      plateNumber: plateNumber || null,
    }),
  });
  return res.json();
}

export async function assignVehicleDevice(user, vehicleId, deviceId) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}/assign-device`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ deviceId: Number(deviceId) }),
  });
  return res.json();
}

export async function updateVehicle(user, vehicleId, { name, plateNumber }) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'PUT',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ name, plateNumber: plateNumber || null }),
  });
  return res.json();
}

export async function fetchVehicleOdometer(user, deviceId) {
  const res = await fetchOrThrow(`/api/vehicle-specs/${encodeURIComponent(deviceId)}/odometer`, {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function verifyVehicleOdometer(user, deviceId, { verifiedOdometerKm, source }) {
  const res = await fetchOrThrow(`/api/vehicle-specs/${encodeURIComponent(deviceId)}/verify-odometer`, {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ verifiedOdometerKm: Number(verifiedOdometerKm), source: source || 'audit' }),
  });
  return res.json();
}

/** Extract `{ error }` from fuel-api JSON bodies thrown by fetchOrThrow. */
export function fuelApiErrorMessage(thrown, fallback = 'Request failed') {
  const raw = thrown?.message || '';
  try {
    const body = JSON.parse(raw);
    if (body?.error) return String(body.error);
  } catch {
    /* plain text or HTML */
  }
  return raw.trim() || fallback;
}

export async function deleteVehicle(user, vehicleId) {
  await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'DELETE',
    headers: fuelApiAuthHeaders(user),
  });
}

export async function fetchVehicle(user, vehicleId) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}`, {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function fetchVehicleFuelStatistics(user, fleetVehicleId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/fuel-statistics`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function updateVehicleConfig(user, vehicleId, body) {
  const res = await fetchOrThrow(`/api/vehicles/${encodeURIComponent(vehicleId)}/config`, {
    method: 'PUT',
    headers: {
      ...fuelApiAuthHeaders(user),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function fetchVehicleServiceRecords(user, fleetVehicleId) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/service-records`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function createVehicleServiceRecord(user, fleetVehicleId, payload) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/service-records`,
    {
      method: 'POST',
      headers: fuelApiAuthHeaders(user),
      body: JSON.stringify(payload),
    },
  );
  return res.json();
}

export async function updateVehicleServiceRecord(user, fleetVehicleId, recordId, payload) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/service-records/${encodeURIComponent(recordId)}`,
    {
      method: 'PATCH',
      headers: fuelApiAuthHeaders(user),
      body: JSON.stringify(payload),
    },
  );
  return res.json();
}
