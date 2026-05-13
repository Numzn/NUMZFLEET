import { getManagerUserIds } from '../../services/userService.js';
import * as repo from './notificationRepository.js';

function uniqIds(ids) {
  return [...new Set(ids.filter((x) => Number.isFinite(Number(x))))];
}

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
 */
export async function persistFuelSocketEvent({ kind, request, change, actorUserId }) {
  if (!request?.id) return;

  const changeType = change?.type || (kind === 'created' ? 'created' : 'updated');
  const { title, message } = buildFuelTitleMessage(changeType, request, change);
  const severity = mapFuelSeverity(changeType, request);
  const changedAt = change?.changedAt || new Date().toISOString();

  const managerIds = await getManagerUserIds();
  const driverId = Number(request.userId);
  let recipients = [];
  if (kind === 'created') {
    recipients = [...managerIds];
  } else {
    recipients = uniqIds([driverId, ...managerIds]);
  }

  const metadata = {
    requestId: request.id,
    deviceId: request.deviceId,
    actorUserId: actorUserId ?? null,
    changeType,
    changedAt,
  };

  const clientDedupKey = `fuel-api:${request.id}:${changeType}:${changedAt}`;

  const rows = recipients.map((userId) => ({
    userId,
    type: `fuel.request.${changeType}`,
    category: 'fuel',
    severity,
    title,
    message,
    source: 'fuel-api',
    metadata,
    read: false,
    archived: false,
    clientDedupKey: `${userId}:${clientDedupKey}`,
  }));

  try {
    await repo.bulkInsertNotifications(rows);
  } catch (e) {
    console.error('[notifications] persistFuelSocketEvent failed', e?.message || e);
  }
}

export async function listForRequestUser(req) {
  return repo.listNotificationsForUser(req.user.id, req.query || {});
}

export async function markRead(req) {
  return repo.markReadForUser(req.user.id, req.params.id);
}

export async function markAllRead(req) {
  return repo.markAllReadForUser(req.user.id);
}

export async function archive(req) {
  return repo.archiveForUser(req.user.id, req.params.id);
}

export async function patchLifecycle(req) {
  return repo.patchLifecycleForUser(req.user.id, req.params.id, req.body || {});
}
