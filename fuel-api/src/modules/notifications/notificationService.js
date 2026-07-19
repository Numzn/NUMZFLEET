import { publishNotification } from '../../notifications/orchestrator/publishNotification.js';
import { fuelRequestPolicy, escalationPolicy } from '../../notifications/policies/notificationPolicyRegistry.js';
import * as repo from './notificationRepository.js';

/** Stable per-transition dedup key — same (requestId, changeType) always
 * collapses to one notification, regardless of when it's built.
 * Kept here (not moved) because notificationPolicyRegistry.js imports this
 * exact binding — see that file's header comment. */
export function buildFuelDedupKey(requestId, changeType) {
  return `fuel-api:${requestId}:${changeType}`;
}

/** A real alertId identifies a specific Traccar alarm — stable, collapses
 * repeats. A manual escalation (no alertId) has no stable identifier and is
 * intentionally never deduped — every call gets a fresh key. */
export function buildEscalationDedupKey(deviceId, alertId) {
  return alertId
    ? `escalate:${deviceId}:${alertId}`
    : `escalate:${deviceId}:manual:${Date.now()}`;
}

function buildFuelTitleMessage(changeType, request, change) {
  const id = request?.id;
  const msg = change?.message;
  if (changeType === 'created') {
    return {
      title: 'New fuel request',
      message: msg || `Request #${id} — ${request?.requestedAmount ?? '?'} L`,
    };
  }
  if (changeType === 'approved') {
    return { title: 'Fuel request approved', message: msg || `Request #${id} approved` };
  }
  if (changeType === 'rejected') {
    return { title: 'Fuel request rejected', message: msg || `Request #${id} rejected` };
  }
  if (changeType === 'fulfilled') {
    return { title: 'Fuel request fulfilled', message: msg || `Request #${id} fulfilled` };
  }
  if (changeType === 'cancelled') {
    return { title: 'Fuel request cancelled', message: msg || `Request #${id} cancelled` };
  }
  return { title: 'Fuel request updated', message: msg || `Request #${id} updated` };
}

/**
 * Persist fuel socket domain events for notification center / audit.
 * @param {{ kind: string, request: object, change: object, actorUserId?: number, io?: import('socket.io').Server }} params
 */
export async function persistFuelSocketEvent({ kind, request, change, actorUserId, io }) {
  if (!request?.id) return;

  const changeType = change?.type || (kind === 'created' ? 'created' : 'updated');
  const { title, message } = buildFuelTitleMessage(changeType, request, change);
  const changedAt = change?.changedAt || new Date().toISOString();

  const policy = fuelRequestPolicy({ kind, changeType, request });
  const metadata = {
    requestId: request.id,
    deviceId: request.deviceId,
    actorUserId: actorUserId ?? null,
    changeType,
    changedAt,
    dedupKey: policy.clientDedupKey,
  };

  try {
    await publishNotification({
      type: policy.type,
      entityType: policy.entityType,
      entityId: String(request.id),
      severity: policy.severity,
      title,
      message,
      source: 'fuel-api',
      audience: policy.audience,
      metadata,
      clientDedupKey: policy.clientDedupKey,
      channels: policy.channels,
    }, { io });
  } catch (e) {
    console.error('[notifications] persistFuelSocketEvent failed', e?.message || e);
  }
}

export async function listForRequestUser(req) {
  return repo.listNotificationsForUser(req.user.id, req.query || {}, req.auth?.companyId);
}

export async function syncForRequestUser(req) {
  return repo.syncNotificationsForUser(req.user.id, req.query || {}, req.auth?.companyId);
}

export async function markRead(req) {
  return repo.markReadForUserByIdOrDedup(req.user.id, req.params.id);
}

export async function markAllRead(req) {
  return repo.markAllReadForUser(req.user.id);
}

export async function archive(req) {
  return repo.archiveForUserByIdOrDedup(req.user.id, req.params.id);
}

export async function patchLifecycle(req) {
  return repo.patchLifecycleForUser(req.user.id, req.params.id, req.body || {});
}

export async function escalateVehicleAlert(req) {
  const { deviceId, alertId, message, title } = req.body || {};
  const userId = req.user?.id;
  if (!deviceId) {
    const err = new Error('deviceId is required');
    err.statusCode = 400;
    throw err;
  }
  const policy = escalationPolicy({ deviceId, alertId });
  await publishNotification({
    type: policy.type,
    entityType: policy.entityType,
    entityId: String(alertId || deviceId),
    severity: policy.severity,
    title: title || 'Vehicle alert escalated',
    message: message || `Alert escalated for device ${deviceId}`,
    source: 'fuel-api',
    audience: policy.audience,
    metadata: {
      deviceId: Number(deviceId),
      alertId: alertId ?? null,
      escalatedBy: userId,
      dedupKey: policy.clientDedupKey,
    },
    clientDedupKey: policy.clientDedupKey,
    channels: policy.channels,
  }, { io: req.io });
  return { ok: true };
}
