import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders, fuelApiMultipartHeaders } from '../../config/fuelApiAuth.js';

export async function fetchMyProfile(user) {
  const res = await fetchOrThrow('/api/me', { headers: fuelApiAuthHeaders(user) });
  return res.json();
}

export async function updateMyProfile(user, patch) {
  const res = await fetchOrThrow('/api/me', {
    method: 'PATCH',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify(patch),
  });
  return res.json();
}

export async function uploadMyAvatar(user, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetchOrThrow('/api/me/avatar', {
    method: 'POST',
    headers: fuelApiMultipartHeaders(user),
    body: formData,
  });
  return res.json();
}
