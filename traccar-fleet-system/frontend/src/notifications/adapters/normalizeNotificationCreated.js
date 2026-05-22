import { mapServerNotificationToEntity } from '../notificationApi.js';

/**
 * Map fuel-api notification.created socket payload to Redux entity.
 * Requires persisted server id (persist-before-emit).
 * @param {object} payload
 */
export function normalizeNotificationCreated(payload) {
  if (!payload?.id) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[notifications] ignored socket payload without id', payload?.type);
    }
    return null;
  }

  return mapServerNotificationToEntity({
    id: payload.id,
    type: payload.type,
    category: payload.entityType || payload.category,
    entityType: payload.entityType || payload.category,
    entityId: payload.entityId,
    severity: payload.severity,
    title: payload.title,
    message: payload.message,
    source: payload.source,
    metadata: payload.metadata,
    read: payload.read,
    readAt: payload.readAt,
    archived: payload.archived,
    createdAt: payload.createdAt,
    viewedAt: payload.viewedAt,
    acknowledgedAt: payload.acknowledgedAt,
    resolvedAt: payload.resolvedAt,
  });
}
