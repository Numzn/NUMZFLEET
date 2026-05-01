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
