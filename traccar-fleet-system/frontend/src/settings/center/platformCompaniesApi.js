import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

export async function fetchCompanies(user) {
  const res = await fetchOrThrow('/api/platform/companies', { headers: fuelApiAuthHeaders(user) });
  return res.json();
}

export async function provisionCompany(user, payload) {
  const res = await fetchOrThrow('/api/platform/companies', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(payload),
  });
  return res.json();
}
