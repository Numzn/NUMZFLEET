import fetchOrThrow from '../../common/util/fetchOrThrow';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';

export async function fetchVapidPublicKey(user) {
  const res = await fetchOrThrow('/api/push-subscriptions/vapid-public-key', { headers: fuelApiAuthHeaders(user) });
  return res.json();
}

/** Server-side truth for this specific device's endpoint — not the browser's own local PushManager state. */
export async function fetchPushSubscriptionStatus(user, endpoint) {
  const res = await fetchOrThrow(`/api/push-subscriptions/status?endpoint=${encodeURIComponent(endpoint)}`, {
    headers: fuelApiAuthHeaders(user),
  });
  return res.json();
}

export async function registerPushSubscription(user, subscription) {
  const res = await fetchOrThrow('/api/push-subscriptions', {
    method: 'POST',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ subscription, userAgent: navigator.userAgent }),
  });
  return res.json();
}

export async function removePushSubscription(user, endpoint) {
  const res = await fetchOrThrow('/api/push-subscriptions', {
    method: 'DELETE',
    headers: fuelApiAuthHeaders(user),
    body: JSON.stringify({ endpoint }),
  });
  return res.json();
}
