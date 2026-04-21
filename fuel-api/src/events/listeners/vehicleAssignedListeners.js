import eventBus from '../eventBus.js';
import { EVENT_NAMES } from '../eventNames.js';
import { withSafeListener } from '../safeListener.js';
import { upsertTraccarDeviceAttribute } from '../../config/traccar.js';

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

export const registerVehicleAssignedListeners = (io) => {
  registerTraccarSyncListener();
  registerSocketBroadcastListener(io);
  registerAuditLogListener();
};
