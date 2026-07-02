import { useSelector } from 'react-redux';
import { fuelApiAuthHeaders } from '../../config/fuelApiAuth.js';
import fetchOrThrow from '../../common/util/fetchOrThrow.js';

export async function escalateVehicleAlert(user, { deviceId, alertId, message, title }) {
  if (!user) throw new Error('Not authenticated');
  const response = await fetchOrThrow('/api/notifications/escalate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...fuelApiAuthHeaders(user),
    },
    body: JSON.stringify({
      deviceId,
      alertId,
      message,
      title,
    }),
  });
  return response.json();
}

export function useEscalateVehicleAlert() {
  const user = useSelector((s) => s.session.user);
  return (payload) => escalateVehicleAlert(user, payload);
}
