import { publishNotification } from '../notifications/orchestrator/publishNotification.js';
import { CHANNELS } from '../notifications/contracts/notificationContract.js';
import { getNotificationIo } from '../notifications/notificationContext.js';
import { emitDomainEvent } from '../events/eventBus.js';
import { EVENT_NAMES } from '../events/eventNames.js';

/**
 * Operation-session notifications (approve / lock approaching / incomplete / unlock).
 * Audience is always the operation owner plus fleet managers so whoever can act
 * on the daily fuel loop is alerted. Notifications carry a `deepLink` in metadata
 * so the notification center can open the operation directly.
 */

function operationDeepLink(operationId) {
  return `/fleet/operation-sessions/run/${operationId}`;
}

function ownerAndManagersAudience(operation) {
  return { includeDriverWithManagers: true, driverId: Number(operation.userId) };
}

function calendarKey(operation) {
  return operation.calendarDate ? String(operation.calendarDate).slice(0, 10) : null;
}

function operationLabel(operation) {
  return operation.name || `Fuel operation ${calendarKey(operation) || ''}`.trim();
}

async function publish(spec, operation) {
  emitDomainEvent(EVENT_NAMES.OPERATION_NOTIFICATION, { operation, spec });
}

export async function deliverOperationNotification({ operation, spec }) {
  try {
    await publishNotification({
      source: 'fuel-api',
      entityType: 'fuel',
      channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
      ...spec,
    }, { io: getNotificationIo() });
  } catch (e) {
    console.error('[notifications] operation notify failed', spec?.type, e?.message || e);
  }
}

function buildSpec(operation, { type, severity, title, message, event, extraMeta = {} }) {
  const dedupKey = `operation:${operation.id}:${event}`;
  return {
    type,
    severity,
    title,
    message,
    audience: ownerAndManagersAudience(operation),
    entityId: String(operation.id),
    clientDedupKey: dedupKey,
    metadata: {
      operationId: operation.id,
      calendarDate: calendarKey(operation),
      deepLink: operationDeepLink(operation.id),
      event,
      dedupKey,
      ...extraMeta,
    },
  };
}

export async function notifyPlanReady(operation, actorUserId) {
  if (!operation?.id) return;
  await publish(buildSpec(operation, {
    type: 'operation.plan.ready',
    severity: 'info',
    title: 'Fuel plan ready for approval',
    message: `${operationLabel(operation)} has vehicles planned and is ready to approve.`,
    event: 'plan-ready',
    extraMeta: { actorUserId: actorUserId ?? null },
  }), operation);
}

export async function notifyOperationApproved(operation, actorUserId) {
  if (!operation?.id) return;
  await publish(buildSpec(operation, {
    type: 'operation.approved',
    severity: 'success',
    title: 'Fuel operation approved',
    message: `${operationLabel(operation)} was approved and is now open for recording.`,
    event: 'approved',
    extraMeta: { actorUserId: actorUserId ?? null },
  }), operation);
}

export async function notifyOperationUnlocked(operation, actorUserId, { expiresAt, reason } = {}) {
  if (!operation?.id) return;
  await publish(buildSpec(operation, {
    type: 'operation.unlocked',
    severity: 'info',
    title: 'Fuel operation unlocked',
    message: `${operationLabel(operation)} was unlocked for edits${reason ? ` (${reason})` : ''}.`,
    // Unlock windows can be granted more than once — key on expiry so each grant alerts.
    event: `unlocked:${expiresAt || Date.now()}`,
    extraMeta: { actorUserId: actorUserId ?? null, expiresAt: expiresAt || null, reason: reason || null },
  }), operation);
}

export async function notifyLockApproaching(operation, minutesRemaining) {
  if (!operation?.id) return;
  await publish(buildSpec(operation, {
    type: 'operation.lock.approaching',
    severity: 'warning',
    title: 'Fuel operation locks soon',
    message: `${operationLabel(operation)} locks in about ${minutesRemaining} minutes. Finish recording before it closes.`,
    event: 'lock-approaching',
    extraMeta: { minutesRemaining },
  }), operation);
}

export async function notifyRecordingIncompleteAtLock(operation, { incomplete, total }) {
  if (!operation?.id) return;
  await publish(buildSpec(operation, {
    type: 'operation.recording.incomplete',
    severity: 'warning',
    title: 'Fuel recording incomplete',
    message: `${incomplete} of ${total} vehicles are still unrecorded as ${operationLabel(operation)} approaches lock.`,
    event: 'recording-incomplete',
    extraMeta: { incomplete, total },
  }), operation);
}

export default {
  notifyPlanReady,
  notifyOperationApproved,
  notifyOperationUnlocked,
  notifyLockApproaching,
  notifyRecordingIncompleteAtLock,
};
