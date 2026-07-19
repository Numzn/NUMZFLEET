import { publishNotification } from '../notifications/orchestrator/publishNotification.js';
import { CHANNELS } from '../notifications/contracts/notificationContract.js';
import { getNotificationIo } from '../notifications/notificationContext.js';
import { emitDomainEvent } from '../events/eventBus.js';
import { EVENT_NAMES } from '../events/eventNames.js';
import {
  operationPlanReadyPolicy,
  operationApprovedPolicy,
  operationUnlockedPolicy,
  operationLockApproachingPolicy,
  operationRecordingIncompletePolicy,
} from '../notifications/policies/notificationPolicyRegistry.js';

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

// `dedupKey` and `event` are now supplied by the caller (from the policy
// registry) rather than derived here — the registry is the single source of
// truth for the dedup pattern; this function just assembles the publish spec.
function buildSpec(operation, { type, severity, title, message, event, dedupKey, extraMeta = {} }) {
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
  const policy = operationPlanReadyPolicy({ operationId: operation.id });
  await publish(buildSpec(operation, {
    type: policy.type,
    severity: policy.severity,
    title: 'Fuel plan ready for approval',
    message: `${operationLabel(operation)} has vehicles planned and is ready to approve.`,
    event: 'plan-ready',
    dedupKey: policy.clientDedupKey,
    extraMeta: { actorUserId: actorUserId ?? null },
  }), operation);
}

export async function notifyOperationApproved(operation, actorUserId) {
  if (!operation?.id) return;
  const policy = operationApprovedPolicy({ operationId: operation.id });
  await publish(buildSpec(operation, {
    type: policy.type,
    severity: policy.severity,
    title: 'Fuel operation approved',
    message: `${operationLabel(operation)} was approved and is now open for recording.`,
    event: 'approved',
    dedupKey: policy.clientDedupKey,
    extraMeta: { actorUserId: actorUserId ?? null },
  }), operation);
}

export async function notifyOperationUnlocked(operation, actorUserId, { expiresAt, reason } = {}) {
  if (!operation?.id) return;
  // Unlock windows can be granted more than once — the policy keys on expiry
  // so each grant alerts; falls back to an always-fresh key if expiresAt is
  // absent. Do not collapse this across grants.
  const policy = operationUnlockedPolicy({ operationId: operation.id, expiresAt });
  await publish(buildSpec(operation, {
    type: policy.type,
    severity: policy.severity,
    title: 'Fuel operation unlocked',
    message: `${operationLabel(operation)} was unlocked for edits${reason ? ` (${reason})` : ''}.`,
    // Reuses the policy's resolvedKey (not a second, independently-computed
    // Date.now()) so the event label and dedup key never diverge.
    event: `unlocked:${policy.resolvedKey}`,
    dedupKey: policy.clientDedupKey,
    extraMeta: { actorUserId: actorUserId ?? null, expiresAt: expiresAt || null, reason: reason || null },
  }), operation);
}

export async function notifyLockApproaching(operation, minutesRemaining) {
  if (!operation?.id) return;
  const policy = operationLockApproachingPolicy({ operationId: operation.id });
  await publish(buildSpec(operation, {
    type: policy.type,
    severity: policy.severity,
    title: 'Fuel operation locks soon',
    message: `${operationLabel(operation)} locks in about ${minutesRemaining} minutes. Finish recording before it closes.`,
    event: 'lock-approaching',
    dedupKey: policy.clientDedupKey,
    extraMeta: { minutesRemaining },
  }), operation);
}

export async function notifyRecordingIncompleteAtLock(operation, { incomplete, total }) {
  if (!operation?.id) return;
  const policy = operationRecordingIncompletePolicy({ operationId: operation.id });
  await publish(buildSpec(operation, {
    type: policy.type,
    severity: policy.severity,
    title: 'Fuel recording incomplete',
    message: `${incomplete} of ${total} vehicles are still unrecorded as ${operationLabel(operation)} approaches lock.`,
    event: 'recording-incomplete',
    dedupKey: policy.clientDedupKey,
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
