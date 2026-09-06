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
  fuelAnomalyPolicy,
} from '../../notifications/policies/notificationPolicyRegistry.js';

function isFuelAnomalyEnabled() {
  const raw = String(process.env.FUEL_ANOMALY_NOTIFICATIONS_ENABLED || '0').toLowerCase();
  return raw === '1' || raw === 'true';
}

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
    urgency: policy.urgency,
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

/**
 * Same "exceeds tank capacity" formula RefuelEngine.js already computes live
 * on every refuel completion (actualFuelLitres > tankCapacitySnapshot) —
 * recomputed here rather than trusting the persisted `status` column, since
 * that column also gets set to 'flagged' by an unrelated variance check
 * (ValidationEngine.js) and conflating the two would mislabel a legitimate
 * high-variance-but-within-capacity refuel as a capacity anomaly.
 */
async function notifyFuelAnomaly({ session, refuel, io }) {
  if (!isFuelAnomalyEnabled()) return;
  const litres = Number(refuel?.actualFuelLitres);
  const cap = Number(refuel?.tankCapacitySnapshot);
  if (!Number.isFinite(litres) || !Number.isFinite(cap) || cap <= 0 || litres <= cap) return;

  const policy = fuelAnomalyPolicy({ sessionId: session?.id, refuelId: refuel?.id });
  await publishNotification({
    source: 'fuel-api',
    entityType: policy.entityType,
    type: policy.type,
    severity: policy.severity,
    urgency: policy.urgency,
    title: 'Refuel exceeds tank capacity',
    message: `Vehicle ${refuel?.vehicleId} — ${litres} L recorded against a ${cap} L tank`,
    audience: policy.audience,
    companyId: session?.companyId ?? null,
    entityId: String(session?.id),
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
    metadata: {
      operationId: session?.id,
      sessionId: session?.id,
      refuelId: refuel?.id,
      vehicleId: refuel?.vehicleId,
      actualFuelLitres: litres,
      tankCapacitySnapshot: cap,
      deepLink: `/fleet/operation-sessions/fuel/${session?.id}`,
      event: 'fuel.anomaly.exceeds_capacity',
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
    urgency: policy.urgency,
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
    urgency: policy.urgency,
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
    urgency: policy.urgency,
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
    urgency: policy.urgency,
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
      // io was previously never passed here (payload itself carries no io) —
      // meaning this notification's realtime websocket push silently never
      // fired, only the persisted row + queued external-channel delivery.
      await notifyRefuelRecorded({ ...payload, io });
    }),
  );

  eventBus.on(
    EVENT_NAMES.OPERATION_REFUEL_RECORDED,
    withSafeListener(EVENT_NAMES.OPERATION_REFUEL_RECORDED, 'fuel-anomaly-check', async (payload) => {
      await notifyFuelAnomaly({ ...payload, io });
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
