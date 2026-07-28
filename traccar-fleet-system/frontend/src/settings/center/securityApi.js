import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

export async function changeMyPassword(user, { currentPassword, newPassword }) {
  const res = await fetchOrThrow('/api/me/password', {
    method: 'PATCH',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return res.json();
}

export async function fetchMyLoginHistory(user, { before } = {}) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  const qs = params.toString();
  const res = await fetchOrThrow(`/api/me/login-history${qs ? `?${qs}` : ''}`, {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}
