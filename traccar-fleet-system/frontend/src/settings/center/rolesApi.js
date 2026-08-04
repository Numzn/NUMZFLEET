import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

export async function fetchSystemRoles(user) {
  const res = await fetchOrThrow('/api/roles', { headers: fuelApiAuthHeaders(user) });
  return res.json();
}

export async function fetchRoleAssignments(user) {
  const res = await fetchOrThrow('/api/roles/assignments', { headers: fuelApiAuthHeaders(user) });
  return res.json();
}

export async function assignRole(user, traccarUserId, roleKey) {
  const res = await fetchOrThrow('/api/roles/assignments', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ traccarUserId, roleKey }),
  });
  return res.json();
}

export async function removeRoleAssignment(user, userRoleId) {
  const res = await fetchOrThrow(`/api/roles/assignments/${userRoleId}`, {
    method: 'DELETE',
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}
