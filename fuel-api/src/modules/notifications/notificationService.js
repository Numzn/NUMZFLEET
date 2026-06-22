import { publishNotification } from '../../notifications/orchestrator/publishNotification.js';
import { CHANNELS } from '../../notifications/contracts/notificationContract.js';
import * as repo from './notificationRepository.js';

function mapFuelSeverity(changeType, request) {
  if (changeType === 'created') {
    return request?.urgency === 'emergency' ? 'critical' : 'warning';
  }
  if (changeType === 'approved' || changeType === 'fulfilled') return 'success';
  if (changeType === 'rejected' || changeType === 'cancelled') return 'warning';
  return 'info';
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
  const severity = mapFuelSeverity(changeType, request);
  const changedAt = change?.changedAt || new Date().toISOString();

  const audience = kind === 'created'
    ? { managers: true }
    : { includeDriverWithManagers: true, driverId: Number(request.userId) };

  const dedupKey = `fuel-api:${request.id}:${changeType}`;
  const metadata = {
    requestId: request.id,
    deviceId: request.deviceId,
    actorUserId: actorUserId ?? null,
    changeType,
    changedAt,
    dedupKey,
  };

  try {
    await publishNotification({
      type: `fuel.request.${changeType}`,
      entityType: 'fuel',
      entityId: String(request.id),
      severity,
      title,
      message,
      source: 'fuel-api',
      audience,
      metadata,
      clientDedupKey: `fuel-api:${request.id}:${changeType}:${changedAt}`,
      channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
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
