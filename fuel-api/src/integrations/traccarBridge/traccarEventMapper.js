import {
  buildTraccarNotificationCopy,
  resolveTraccarTrackingPolicy,
  traccarClientDedupKey,
} from '../../notifications/policies/notificationPolicyService.js';

/**
 * @param {object} row - tc_events row
 * @param {number} userId
 */
export function mapTraccarEventToNotificationRow(row, userId) {
  const policy = resolveTraccarTrackingPolicy({
    type: row.type,
    attributes: row.attributes,
  });
  if (!policy.persist) return null;

  const { title, message } = buildTraccarNotificationCopy(row, policy);
  const eventId = row.id;
  const deviceId = row.deviceid;

  return {
    userId,
    type: policy.notificationType,
    category: policy.category,
    severity: policy.severity,
    title,
    message,
    source: 'traccar',
    metadata: {
      traccarEventId: eventId,
      deviceId,
      traccarType: row.type,
      alarmAttr: row.attributes?.alarm ?? null,
      dedupKey: `traccar:${eventId}`,
      resolvedType: policy.resolvedType,
    },
    read: false,
    archived: false,
    clientDedupKey: traccarClientDedupKey(eventId, userId),
    createdAt: row.eventtime ? new Date(row.eventtime) : new Date(),
    updatedAt: new Date(),
  };
}
