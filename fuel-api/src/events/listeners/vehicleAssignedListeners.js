import eventBus from '../eventBus.js';
import { EVENT_NAMES } from '../eventNames.js';
import { withSafeListener } from '../safeListener.js';
import { upsertTraccarDeviceAttribute } from '../../config/traccar.js';
import { publishNotification } from '../../notifications/orchestrator/publishNotification.js';
import { CHANNELS } from '../../notifications/contracts/notificationContract.js';

const SOCKET_EVENT_NAME = 'vehicle-assignment-updated';

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
        await upsertTraccarDeviceAttribute(Number(deviceId), 'fleetVehicleId', Number(vehicleId));
      },
    ),
  );
};

const registerSocketBroadcastListener = (io) => {
  eventBus.on(
    EVENT_NAMES.VEHICLE_ASSIGNED,
    withSafeListener(
      EVENT_NAMES.VEHICLE_ASSIGNED,
      'emit-manager-socket-update',
      ({ vehicleId, deviceId, vehicleName, previousDeviceId, assignedAt, actorUserId }) => {
        if (!io?.sockets) {
          return;
        }

        io.to('managers').emit(SOCKET_EVENT_NAME, {
          event: EVENT_NAMES.VEHICLE_ASSIGNED,
          vehicleId,
          deviceId,
          vehicleName,
          previousDeviceId,
          assignedAt,
          changedBy: actorUserId,
        });
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
        const at = assignedAt || new Date().toISOString();
        await publishNotification({
          type: 'assignment.vehicle.updated',
          category: 'assignment',
          severity: 'info',
          title: 'Vehicle assignment updated',
          message: vehicleName
            ? `${vehicleName} assigned to device ${deviceId}`
            : `Vehicle ${vehicleId} assigned to device ${deviceId}`,
          source: 'fuel-api',
          audience: { managers: true },
          metadata: {
            vehicleId,
            deviceId,
            vehicleName,
            previousDeviceId,
            assignedAt: at,
            actorUserId,
            dedupKey: `assignment:${vehicleId}:${deviceId}:${at}`,
          },
          clientDedupKey: `assignment:${vehicleId}:${deviceId}:${at}`,
          channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
        }, { io });
      },
    ),
  );
};

export const registerVehicleAssignedListeners = (io) => {
  registerTraccarSyncListener();
  registerSocketBroadcastListener(io);
  registerPersistNotificationListener(io);
  registerAuditLogListener();
};
