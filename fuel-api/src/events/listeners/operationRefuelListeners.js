import eventBus from '../eventBus.js';
import { EVENT_NAMES } from '../eventNames.js';
import { withSafeListener } from '../safeListener.js';
import {
  emitOperationRefuelEvent,
  emitOperationInvoiceReconciled,
  emitVehicleDocumentOcrCompleted,
} from '../../operations/handlers/operationSocketEvents.js';
import { publishNotification } from '../../notifications/orchestrator/publishNotification.js';
import { CHANNELS } from '../../notifications/contracts/notificationContract.js';

async function notifyRefuelRecorded({ session, refuel, actorUserId, io }) {
  const litres = refuel?.actualFuelLitres;
  await publishNotification({
    source: 'fuel-api',
    entityType: 'fuel',
    type: 'operation.refuel.recorded',
    severity: 'info',
    title: 'Refuel recorded',
    message: `Vehicle ${refuel?.vehicleId} — ${litres != null ? `${litres} L` : 'fuel captured'}`,
    audience: { includeDriverWithManagers: true, driverId: Number(session?.userId) },
    entityId: String(session?.id),
    clientDedupKey: `operation:${session?.id}:refuel:${refuel?.id}:recorded`,
    channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
    metadata: {
      operationId: session?.id,
      sessionId: session?.id,
      refuelId: refuel?.id,
      vehicleId: refuel?.vehicleId,
      deepLink: `/fleet/operation-sessions/fuel/${session?.id}`,
      event: 'refuel.recorded',
    },
  }, { io });
}

import { deliverOperationNotification } from '../../services/operationNotificationService.js';

export const registerOperationRefuelListeners = (io) => {
  eventBus.on(
    EVENT_NAMES.OPERATION_NOTIFICATION,
    withSafeListener(EVENT_NAMES.OPERATION_NOTIFICATION, 'deliver-notification', async (payload) => {
      await deliverOperationNotification(payload);
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_REFUEL_RECORDED,
    withSafeListener(EVENT_NAMES.OPERATION_REFUEL_RECORDED, 'socket-notify', (payload) => {
      emitOperationRefuelEvent(io, 'operation-refuel-recorded', payload);
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_REFUEL_RECORDED,
    withSafeListener(EVENT_NAMES.OPERATION_REFUEL_RECORDED, 'persist-notification', async (payload) => {
      await notifyRefuelRecorded(payload);
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_REFUEL_ARRIVED,
    withSafeListener(EVENT_NAMES.OPERATION_REFUEL_ARRIVED, 'socket-notify', (payload) => {
      emitOperationRefuelEvent(io, 'operation-refuel-arrived', payload);
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_REFUEL_SKIPPED,
    withSafeListener(EVENT_NAMES.OPERATION_REFUEL_SKIPPED, 'socket-notify', (payload) => {
      emitOperationRefuelEvent(io, 'operation-refuel-skipped', payload);
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_INVOICE_RECONCILED,
    withSafeListener(EVENT_NAMES.OPERATION_INVOICE_RECONCILED, 'socket-notify', (payload) => {
      emitOperationInvoiceReconciled(io, payload);
    }),
  );

  eventBus.on(
    EVENT_NAMES.VEHICLE_DOCUMENT_OCR_COMPLETED,
    withSafeListener(EVENT_NAMES.VEHICLE_DOCUMENT_OCR_COMPLETED, 'socket-notify', (payload) => {
      emitVehicleDocumentOcrCompleted(io, payload);
    }),
  );
};
