import { SOURCES, SEVERITY } from '../../store/notifications/notificationTypes.js';
import { stableNotificationId, truncateMessage } from '../../store/notifications/notificationUtils.js';

/**
 * @param {object} payload - from vehicle-assignment-updated socket
 * @returns {import('../../store/notifications/notificationsSlice.js').NotificationEntity|null}
 */
export function normalizeVehicleAssignmentEvent(payload) {
  if (!payload?.deviceId && !payload?.vehicleId) return null;

  const at = payload.assignedAt || new Date().toISOString();
  const id = stableNotificationId({
    source: SOURCES.FUEL_API,
    type: 'vehicle.assigned',
    entityId: payload.vehicleId ?? payload.deviceId,
    changeType: 'assignment',
    at,
  });

  const vehicleName = payload.vehicleName || 'Vehicle';
  const title = 'Vehicle assignment updated';
  const message = `Device ${payload.deviceId} → ${vehicleName}`;

  return {
    id,
    type: 'fleet.vehicle.assigned',
    category: 'assignment',
    severity: SEVERITY.INFO,
    title,
    message: truncateMessage(message),
    source: SOURCES.FUEL_API,
    timestamp: typeof at === 'string' ? at : new Date(at).toISOString(),
    read: false,
    archived: false,
    actionable: true,
    metadata: {
      vehicleId: payload.vehicleId,
      deviceId: payload.deviceId,
      previousDeviceId: payload.previousDeviceId,
      changedBy: payload.changedBy,
      dedupKey: `${SOURCES.FUEL_API}:assignment:${payload.vehicleId}:${payload.deviceId}:${at}`,
      delivered: {},
    },
  };
}
