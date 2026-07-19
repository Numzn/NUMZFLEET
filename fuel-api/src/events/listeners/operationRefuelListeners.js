import eventBus from '../eventBus.js';
import { EVENT_NAMES } from '../eventNames.js';
import { withSafeListener } from '../safeListener.js';
import { emitVehicleDocumentOcrCompleted } from '../../operations/handlers/operationSocketEvents.js';
import { publishNotification } from '../../notifications/orchestrator/publishNotification.js';
import {
  operationRefuelRecordedPolicy,
  operationRefuelArrivedPolicy,
  operationRefuelSkippedPolicy,
  operationInvoiceReconciledPolicy,
  vehicleDocumentOcrCompletedPolicy,
} from '../../notifications/policies/notificationPolicyRegistry.js';

async function notifyRefuelRecorded({ session, refuel, actorUserId, io }) {
  const litres = refuel?.actualFuelLitres;
  const policy = operationRefuelRecordedPolicy({
    sessionId: session?.id,
    refuelId: refuel?.id,
    driverId: session?.userId,
  });
  await publishNotification({
    source: 'fuel-api',
    entityType: policy.entityType,
    type: policy.type,
    severity: policy.severity,
    title: 'Refuel recorded',
    message: `Vehicle ${refuel?.vehicleId} — ${litres != null ? `${litres} L` : 'fuel captured'}`,
    audience: policy.audience,
    entityId: String(session?.id),
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
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

async function notifyRefuelArrived({ session, refuel, io }) {
  const policy = operationRefuelArrivedPolicy({
    sessionId: session?.id,
    refuelId: refuel?.id,
    driverId: session?.userId,
  });
  await publishNotification({
    source: 'fuel-api',
    entityType: policy.entityType,
    type: policy.type,
    severity: policy.severity,
    title: 'Vehicle arrived',
    message: `Vehicle ${refuel?.vehicleId} has arrived for fueling`,
    audience: policy.audience,
    entityId: String(session?.id),
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
    metadata: {
      operationId: session?.id,
      sessionId: session?.id,
      refuelId: refuel?.id,
      vehicleId: refuel?.vehicleId,
      deepLink: `/fleet/operation-sessions/fuel/${session?.id}`,
      event: 'refuel.arrived',
    },
  }, { io });
}

async function notifyRefuelSkipped({ session, refuel, reason, io }) {
  const policy = operationRefuelSkippedPolicy({
    sessionId: session?.id,
    refuelId: refuel?.id,
    driverId: session?.userId,
  });
  await publishNotification({
    source: 'fuel-api',
    entityType: policy.entityType,
    type: policy.type,
    severity: policy.severity,
    title: 'Vehicle skipped',
    message: `Vehicle ${refuel?.vehicleId} was skipped${reason ? `: ${reason}` : ''}`,
    audience: policy.audience,
    entityId: String(session?.id),
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
    metadata: {
      operationId: session?.id,
      sessionId: session?.id,
      refuelId: refuel?.id,
      vehicleId: refuel?.vehicleId,
      reason,
      deepLink: `/fleet/operation-sessions/fuel/${session?.id}`,
      event: 'refuel.skipped',
    },
  }, { io });
}

async function notifyInvoiceReconciled({ session, invoiceId, io }) {
  const policy = operationInvoiceReconciledPolicy({
    sessionId: session?.id,
    invoiceId,
    driverId: session?.userId,
  });
  await publishNotification({
    source: 'fuel-api',
    entityType: policy.entityType,
    type: policy.type,
    severity: policy.severity,
    title: 'Invoice reconciled',
    message: `Operation invoice reconciled for session ${session?.id}`,
    audience: policy.audience,
    entityId: String(session?.id),
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
    metadata: {
      operationId: session?.id,
      sessionId: session?.id,
      invoiceId,
      deepLink: `/fleet/operation-sessions/fuel/${session?.id}`,
      event: 'invoice.reconciled',
    },
  }, { io });
}

async function notifyVehicleDocumentOcrCompleted({ fleetVehicleId, documentId, ocrStatus, io }) {
  const policy = vehicleDocumentOcrCompletedPolicy({ fleetVehicleId, documentId });
  await publishNotification({
    source: 'fuel-api',
    entityType: policy.entityType,
    type: policy.type,
    severity: policy.severity,
    title: 'Document OCR completed',
    message: `Vehicle document OCR ${ocrStatus || 'completed'}`,
    audience: policy.audience,
    entityId: String(fleetVehicleId),
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
    metadata: {
      fleetVehicleId,
      documentId,
      ocrStatus,
      deepLink: `/fleet/vehicles/${fleetVehicleId}/documents`,
      event: 'vehicle.document.ocr.completed',
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
    withSafeListener(EVENT_NAMES.OPERATION_REFUEL_RECORDED, 'persist-notification', async (payload) => {
      await notifyRefuelRecorded(payload);
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_REFUEL_ARRIVED,
    withSafeListener(EVENT_NAMES.OPERATION_REFUEL_ARRIVED, 'persist-notification', async (payload) => {
      await notifyRefuelArrived({ ...payload, io });
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_REFUEL_SKIPPED,
    withSafeListener(EVENT_NAMES.OPERATION_REFUEL_SKIPPED, 'persist-notification', async (payload) => {
      await notifyRefuelSkipped({ ...payload, io });
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_INVOICE_RECONCILED,
    withSafeListener(EVENT_NAMES.OPERATION_INVOICE_RECONCILED, 'persist-notification', async (payload) => {
      await notifyInvoiceReconciled({ ...payload, io });
    }),
  );

  eventBus.on(
    EVENT_NAMES.VEHICLE_DOCUMENT_OCR_COMPLETED,
    withSafeListener(EVENT_NAMES.VEHICLE_DOCUMENT_OCR_COMPLETED, 'socket-notify', (payload) => {
      emitVehicleDocumentOcrCompleted(io, payload);
    }),
  );

  eventBus.on(
    EVENT_NAMES.VEHICLE_DOCUMENT_OCR_COMPLETED,
    withSafeListener(EVENT_NAMES.VEHICLE_DOCUMENT_OCR_COMPLETED, 'persist-notification', async (payload) => {
      await notifyVehicleDocumentOcrCompleted({ ...payload, io });
    }),
  );
};
