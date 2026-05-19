import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

function vehiclePath(vehicleId, suffix) {
  return `/api/vehicles/${encodeURIComponent(vehicleId)}${suffix}`;
}

export async function fetchImmobilizationCapabilities(user, vehicleId) {
  const res = await fetchOrThrow(vehiclePath(vehicleId, '/immobilization/capabilities'), {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function fetchActiveImmobilizationIntent(user, vehicleId) {
  const res = await fetchOrThrow(vehiclePath(vehicleId, '/immobilization-intents/active'), {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function fetchImmobilizationIntentHistory(user, vehicleId, limit = 20) {
  const qs = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : '';
  const res = await fetchOrThrow(vehiclePath(vehicleId, `/immobilization-intents${qs}`), {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function createImmobilizationIntent(user, vehicleId, action) {
  const res = await fetchOrThrow(vehiclePath(vehicleId, '/immobilization-intents'), {
    method: 'POST',
    headers: {
      ...fuelApiAuthHeaders(user),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
  return res.json();
}

export async function cancelImmobilizationIntent(user, vehicleId, intentId) {
  const res = await fetchOrThrow(
    vehiclePath(vehicleId, `/immobilization-intents/${encodeURIComponent(intentId)}/cancel`),
    {
      method: 'POST',
      headers: fuelApiAuthHeaders(user),
    },
  );
  return res.json();
}
