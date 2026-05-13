import { SOURCES, SEVERITY } from '../../store/notifications/notificationTypes.js';
import { stableNotificationId, truncateMessage } from '../../store/notifications/notificationUtils.js';

/**
 * @param {'fuel-request-created'|'fuel-request-updated'} eventName
 * @param {object} data - socket payload { request, change }
 * @returns {import('../../store/notifications/notificationsSlice.js').NotificationEntity|null}
 */
export function normalizeFuelRequestEvent(eventName, data) {
  const request = data?.request || data;
  const change = data?.change;
  if (!request?.id) return null;

  const changedAt = change?.changedAt || new Date().toISOString();
  const changeType = change?.type || (eventName === 'fuel-request-created' ? 'created' : 'updated');

  let type = `fuel.request.${changeType}`;
  let severity = SEVERITY.INFO;
  let title = 'Fuel request';
  let message = change?.message || '';

  if (changeType === 'created') {
    title = 'New fuel request';
    severity = request.urgency === 'emergency' ? SEVERITY.CRITICAL : SEVERITY.WARNING;
    message = message || `Request #${request.id} — ${request.requestedAmount ?? '?'} L`;
  } else if (changeType === 'approved') {
    title = 'Fuel request approved';
    severity = SEVERITY.SUCCESS;
    message = message || `Request #${request.id} approved`;
  } else if (changeType === 'rejected') {
    title = 'Fuel request rejected';
    severity = SEVERITY.WARNING;
    message = message || `Request #${request.id} rejected`;
  } else if (changeType === 'fulfilled') {
    title = 'Fuel request fulfilled';
    severity = SEVERITY.SUCCESS;
    message = message || `Request #${request.id} fulfilled`;
  } else if (changeType === 'cancelled') {
    title = 'Fuel request cancelled';
    severity = SEVERITY.WARNING;
    message = message || `Request #${request.id} cancelled`;
  } else if (changeType === 'updated') {
    title = 'Fuel request updated';
    severity = SEVERITY.INFO;
    message = message || `Request #${request.id} updated`;
  } else {
    title = 'Fuel request updated';
    message = message || `Request #${request.id} updated`;
  }

  const id = stableNotificationId({
    source: SOURCES.FUEL_API,
    type,
    entityId: request.id,
    changeType,
    at: changedAt,
  });

  return {
    id,
    type,
    category: 'fuel',
    severity,
    title,
    message: truncateMessage(message),
    source: SOURCES.FUEL_API,
    timestamp: changedAt,
    read: false,
    archived: false,
    actionable: true,
    metadata: {
      requestId: request.id,
      deviceId: request.deviceId,
      userId: request.userId,
      fuelAmount: request.approvedAmount ?? request.requestedAmount,
      vehicleName: request.vehicleName,
      driverName: request.driverName,
      reason: request.notes || request.rejectionReason,
      dedupKey: `${SOURCES.FUEL_API}:${request.id}:${changeType}:${changedAt}`,
      delivered: {},
    },
  };
}
