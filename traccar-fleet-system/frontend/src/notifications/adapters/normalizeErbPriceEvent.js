import { SOURCES, SEVERITY } from '../../store/notifications/notificationTypes.js';
import { stableNotificationId, truncateMessage } from '../../store/notifications/notificationUtils.js';

/**
 * @param {object} payload - { source, timestamp, prices }
 * @returns {import('../../store/notifications/notificationsSlice.js').NotificationEntity|null}
 */
export function normalizeErbPriceEvent(payload) {
  if (!payload) return null;

  const ts = payload.timestamp || new Date().toISOString();
  const keys = payload.prices && typeof payload.prices === 'object'
    ? Object.keys(payload.prices)
    : [];
  const id = stableNotificationId({
    source: SOURCES.FUEL_API,
    type: 'erb.prices.updated',
    entityId: keys.sort().join(',') || 'global',
    changeType: 'update',
    at: ts,
  });

  const title = 'ERB fuel prices updated';
  const message = keys.length
    ? `Prices updated for: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '…' : ''}`
    : 'Price feed updated';

  return {
    id,
    type: 'system.erb.prices',
    category: 'system',
    severity: SEVERITY.INFO,
    title,
    message: truncateMessage(message),
    source: SOURCES.FUEL_API,
    timestamp: typeof ts === 'string' ? ts : new Date(ts).toISOString(),
    read: false,
    archived: false,
    actionable: false,
    metadata: {
      source: payload.source,
      priceKeys: keys,
      dedupKey: `${SOURCES.FUEL_API}:erb:${ts}`,
      delivered: {},
    },
  };
}
