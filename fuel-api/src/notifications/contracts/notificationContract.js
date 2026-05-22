/**
 * @typedef {object} NotificationAudience
 * @property {number[]} [userIds]
 * @property {boolean} [managers]
 * @property {number} [driverId]
 * @property {boolean} [includeDriverWithManagers]
 */

/**
 * @typedef {object} PublishNotificationSpec
 * @property {string} type
 * @property {string} severity
 * @property {string} title
 * @property {string} message
 * @property {NotificationAudience} audience
 * @property {string} clientDedupKey base key before per-user prefix
 * @property {string} [entityType] preferred; falls back to category
 * @property {string} [category] deprecated alias for entityType (DB column)
 * @property {string} [entityId] stable business id; else derived from metadata
 * @property {string} [source] e.g. fuel-api | traccar | erb
 * @property {Record<string, unknown>} [metadata]
 * @property {('inbox'|'websocket'|'push'|'sms'|'email')[]} [channels]
 */

/**
 * @typedef {PublishNotificationSpec & {
 *   entityType: string,
 *   entityId: string,
 *   category: string,
 * }} NormalizedNotification
 */

/**
 * @typedef {object} CanonicalNotificationPayload
 * @property {string} id
 * @property {string} type
 * @property {'info'|'success'|'warning'|'critical'} severity
 * @property {string} title
 * @property {string} message
 * @property {number} userId
 * @property {string} entityType
 * @property {string} entityId
 * @property {string} source
 * @property {string} createdAt
 * @property {string|null} readAt
 * @property {boolean} archived
 * @property {Record<string, unknown>} metadata
 */

export const CHANNELS = Object.freeze({
  INBOX: 'inbox',
  WEBSOCKET: 'websocket',
  PUSH: 'push',
  SMS: 'sms',
  EMAIL: 'email',
});
