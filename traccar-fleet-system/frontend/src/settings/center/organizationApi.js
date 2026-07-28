import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

export async function fetchOrganization(user) {
  const res = await fetchOrThrow('/api/organization', { headers: fuelApiAuthHeaders(user) });
  return res.json();
}

export async function updateOrganization(user, patch) {
  const res = await fetchOrThrow('/api/organization', {
    method: 'PATCH',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(patch),
  });
  return res.json();
}
