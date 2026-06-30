import fetchOrThrow from '../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../config/fuelApiAuth.js';

export async function fetchMaintenanceDashboard(user, { from, to, fleetVehicleId } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (fleetVehicleId) params.set('fleetVehicleId', fleetVehicleId);
  const qs = params.toString();
  const res = await fetchOrThrow(
    `/api/fleet/maintenance/dashboard${qs ? `?${qs}` : ''}`,
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function fetchMaintenanceBudget(user) {
  const res = await fetchOrThrow(
    '/api/fleet/maintenance/budget',
    { headers: fuelApiAuthHeaders(user) },
  );
  return res.json();
}

export async function updateMaintenanceBudget(user, payload) {
  const res = await fetchOrThrow('/api/fleet/maintenance/budget', {
    method: 'PUT',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function createWorkOrder(user, fleetVehicleId, payload) {
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

export async function updateWorkOrder(user, fleetVehicleId, id, patch) {
  const res = await fetchOrThrow(
    `/api/vehicles/${encodeURIComponent(fleetVehicleId)}/service-records/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: fuelApiAuthHeaders(user),
      body: JSON.stringify(patch),
    },
  );
  return res.json();
}
