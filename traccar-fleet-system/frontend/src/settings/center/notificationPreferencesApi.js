import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

export async function fetchNotificationPreferences(user) {
  const res = await fetchOrThrow('/api/notification-preferences', { headers: fuelApiAuthHeaders(user) });
  return res.json();
}

export async function updateNotificationPreferences(user, items) {
  const res = await fetchOrThrow('/api/notification-preferences', {
    method: 'PUT',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ items }),
  });
  return res.json();
}
