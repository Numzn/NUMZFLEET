/**
 * Fleet vehicles (fuel-api / Postgres + Traccar merge). Same auth as fuel-requests / vehicle-specs.
 */

export function vehiclesAuthHeaders(user) {
  return {
    'Content-Type': 'application/json',
    ...(user?.id ? { 'X-User-Id': String(user.id) } : {}),
  };
}

export async function fetchVehicles(user) {
  const res = await fetch('/api/vehicles', {
    credentials: 'include',
    headers: vehiclesAuthHeaders(user),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || res.statusText);
  }
  return res.json();
}

export async function createVehicle(user, { name, plateNumber }) {
  const res = await fetch('/api/vehicles', {
    method: 'POST',
    credentials: 'include',
    headers: vehiclesAuthHeaders(user),
    body: JSON.stringify({
      name,
      plateNumber: plateNumber || null,
    }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || res.statusText);
  }
  return res.json();
}

export async function assignVehicleDevice(user, vehicleId, deviceId) {
  const res = await fetch(`/api/vehicles/${encodeURIComponent(vehicleId)}/assign-device`, {
    method: 'POST',
    credentials: 'include',
    headers: vehiclesAuthHeaders(user),
    body: JSON.stringify({ deviceId: Number(deviceId) }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || res.statusText);
  }
  return res.json();
}
