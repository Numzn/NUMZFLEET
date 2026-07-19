import eventBus from '../eventBus.js';
import { EVENT_NAMES } from '../eventNames.js';
import { withSafeListener } from '../safeListener.js';
import { upsertTraccarDeviceAttribute } from '../../config/traccar.js';
import { publishNotification } from '../../notifications/orchestrator/publishNotification.js';
import { vehicleAssignmentPolicy } from '../../notifications/policies/notificationPolicyRegistry.js';

const registerTraccarSyncListener = () => {
  eventBus.on(
    EVENT_NAMES.VEHICLE_ASSIGNED,
    withSafeListener(
      EVENT_NAMES.VEHICLE_ASSIGNED,
      'sync-traccar-device-labels',
      async ({ previousDeviceId, deviceId, vehicleId, vehicleName }) => {
        if (Number.isFinite(Number(previousDeviceId)) && Number(previousDeviceId) !== Number(deviceId)) {
          await upsertTraccarDeviceAttribute(Number(previousDeviceId), 'vehicleName', null);
          await upsertTraccarDeviceAttribute(Number(previousDeviceId), 'fleetVehicleId', null);
        }

        await upsertTraccarDeviceAttribute(Number(deviceId), 'vehicleName', vehicleName);
        await upsertTraccarDeviceAttribute(Number(deviceId), 'fleetVehicleId', String(vehicleId));
      },
    ),
  );
};

const registerAuditLogListener = () => {
  eventBus.on(
    EVENT_NAMES.VEHICLE_ASSIGNED,
    withSafeListener(
      EVENT_NAMES.VEHICLE_ASSIGNED,
      'audit-log',
      ({ vehicleId, deviceId, vehicleName, previousDeviceId, assignedAt, actorUserId }) => {
        console.log('[audit] vehicle assignment', {
          event: EVENT_NAMES.VEHICLE_ASSIGNED,
          vehicleId,
          deviceId,
          vehicleName,
          previousDeviceId,
          assignedAt,
          actorUserId,
        });
      },
    ),
  );
};

const registerPersistNotificationListener = (io) => {
  eventBus.on(
    EVENT_NAMES.VEHICLE_ASSIGNED,
    withSafeListener(
      EVENT_NAMES.VEHICLE_ASSIGNED,
      'persist-notification',
      async ({ vehicleId, deviceId, vehicleName, previousDeviceId, assignedAt, actorUserId }) => {
        const policy = vehicleAssignmentPolicy({ vehicleId, deviceId, assignedAt });
        await publishNotification({
          type: policy.type,
          entityType: policy.entityType,
          entityId: String(vehicleId),
          severity: policy.severity,
          title: 'Vehicle assignment updated',
          message: vehicleName
            ? `${vehicleName} assigned to device ${deviceId}`
            : `Vehicle ${vehicleId} assigned to device ${deviceId}`,
          source: 'fuel-api',
          audience: policy.audience,
          metadata: {
            vehicleId,
            deviceId,
            vehicleName,
            previousDeviceId,
            assignedAt: policy.resolvedAssignedAt,
            actorUserId,
          },
          clientDedupKey: policy.clientDedupKey,
          channels: policy.channels,
        }, { io });
      },
    ),
  );
};

export const registerVehicleAssignedListeners = (io) => {
  registerTraccarSyncListener();
  registerPersistNotificationListener(io);
  registerAuditLogListener();
};
