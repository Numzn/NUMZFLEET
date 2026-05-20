import { mapServerNotificationToEntity } from '../notificationApi.js';
import { stableNotificationId } from '../../store/notifications/notificationUtils.js';

/**
 * Map fuel-api notification.created socket payload to Redux entity.
 * @param {object} payload
 */
export function normalizeNotificationCreated(payload) {
  if (!payload) return null;

  if (payload.id) {
    return mapServerNotificationToEntity({
      id: payload.id,
      type: payload.type,
      category: payload.category,
      severity: payload.severity,
      title: payload.title,
      message: payload.message,
      source: payload.source,
      metadata: payload.metadata,
      read: payload.read,
      archived: payload.archived,
      createdAt: payload.createdAt,
    });
  }

  const meta = payload.metadata || {};
  const dedup = meta.dedupKey || payload.clientDedupKey;
  const id = stableNotificationId({
    source: payload.source || 'fuel-api',
    type: payload.type || 'system',
    entityId: meta.requestId || meta.traccarEventId || dedup || 'na',
    changeType: meta.changeType || payload.type,
    at: payload.createdAt || meta.changedAt,
  });

  return {
    id,
    type: payload.type || 'system',
    category: payload.category || 'system',
    severity: payload.severity || 'info',
    title: payload.title || '',
    message: payload.message || '',
    source: payload.source || 'fuel-api',
    timestamp: payload.createdAt
      ? new Date(payload.createdAt).toISOString()
      : new Date().toISOString(),
    read: !!payload.read,
    archived: !!payload.archived,
    actionable: true,
    metadata: {
      ...meta,
      dedupKey: dedup || id,
      delivered: {},
    },
  };
}
