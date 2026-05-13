import { NOTIFICATIONS_MAX_CLIENT } from './notificationTypes.js';

/**
 * Stable client id for deduplication and Redux entity keys.
 * @param {{ source: string, type: string, entityId?: string|number, changeType?: string, at?: string|number }} parts
 */
export function stableNotificationId(parts) {
  const {
    source,
    type,
    entityId = 'na',
    changeType = 'na',
    at = 'na',
  } = parts;
  return `${source}:${type}:${entityId}:${changeType}:${at}`;
}

export function truncateMessage(text, maxLen = 500) {
  if (text == null) return '';
  const s = String(text);
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

/** @param {unknown} v @returns {'info'|'success'|'warning'|'critical'} */
export function coerceSeverity(v) {
  if (v === 'success' || v === 'warning' || v === 'critical' || v === 'info') {
    return v;
  }
  return 'info';
}

/**
 * Trim adapter entity list to max length (caller keeps newest first if desired).
 * @template T
 * @param {T[]} items
 * @param {number} [max]
 * @returns {T[]}
 */
export function trimNotificationList(items, max = NOTIFICATIONS_MAX_CLIENT) {
  if (!items?.length) return [];
  if (items.length <= max) return items;
  return items.slice(0, max);
}
