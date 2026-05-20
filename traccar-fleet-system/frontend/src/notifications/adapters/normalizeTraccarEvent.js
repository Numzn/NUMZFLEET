import { prefixString } from '../../common/util/stringUtils.js';
import { SOURCES, SEVERITY } from '../../store/notifications/notificationTypes.js';
import { stableNotificationId, truncateMessage } from '../../store/notifications/notificationUtils.js';

/**
 * Map Traccar WebSocket event to unified Notification (no React / i18n).
 * @param {object} event - Traccar event payload
 * @param {{ t?: (k: string) => string }} [options]
 * @returns {import('../../store/notifications/notificationsSlice.js').NotificationEntity|null}
 */
export function normalizeTraccarEvent(event, options = {}) {
  if (!event || event.id == null) return null;
  const type = event.type || 'unknown';

  // High-volume / low-signal types — server policy also skips persist (see notificationPolicyService).
  if (type === 'deviceOnline' || type === 'deviceOffline'
    || type === 'deviceMoving' || type === 'deviceStopped') {
    return null;
  }

  const { t } = options;
  const msg = event.attributes?.message != null
    ? String(event.attributes.message)
    : '';

  let category = 'tracking';
  let severity = SEVERITY.INFO;

  if (type === 'alarm') {
    category = 'security';
    const alarm = String(event.attributes?.alarm || '').toLowerCase();
    if (alarm === 'geofenceenter' || alarm === 'geofenceexit' || alarm === 'geofence') {
      category = 'tracking';
      severity = SEVERITY.WARNING;
    } else {
      severity = SEVERITY.CRITICAL;
    }
  } else if (type === 'geofenceEnter' || type === 'geofenceExit') {
    category = 'tracking';
    severity = SEVERITY.WARNING;
  } else if (type === 'maintenance') {
    category = 'maintenance';
    severity = SEVERITY.WARNING;
  }

  let title = type;
  if (t) {
    title = t(prefixString('event', type));
    if (type === 'alarm' && event.attributes?.alarm) {
      title = `${title} (${event.attributes.alarm})`;
    }
  } else if (type === 'alarm' && event.attributes?.alarm) {
    title = `Alarm (${event.attributes.alarm})`;
  }

  const timestamp = event.eventTime
    ? new Date(event.eventTime).toISOString()
    : new Date().toISOString();

  const id = stableNotificationId({
    source: SOURCES.TRACCAR,
    type: `event.${type}`,
    entityId: event.id,
    changeType: event.attributes?.alarm || type,
    at: event.eventTime || event.id,
  });

  return {
    id,
    type: `traccar.${type}`,
    category,
    severity,
    title,
    message: truncateMessage(msg || title),
    source: SOURCES.TRACCAR,
    timestamp,
    read: false,
    archived: false,
    actionable: true,
    metadata: {
      traccarEventId: event.id,
      deviceId: event.deviceId,
      traccarType: type,
      alarmAttr: event.attributes?.alarm,
      dedupKey: `traccar:${event.id}`,
      delivered: {},
    },
  };
}
