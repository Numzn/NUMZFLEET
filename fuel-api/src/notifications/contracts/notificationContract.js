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
 * @property {string} category
 * @property {string} severity
 * @property {string} title
 * @property {string} message
 * @property {string} [source]
 * @property {NotificationAudience} audience
 * @property {Record<string, unknown>} [metadata]
 * @property {string} [clientDedupKey] base key before per-user prefix
 * @property {('inbox'|'websocket'|'push'|'sms'|'email')[]} [channels]
 */

export const CHANNELS = Object.freeze({
  INBOX: 'inbox',
  WEBSOCKET: 'websocket',
  PUSH: 'push',
  SMS: 'sms',
  EMAIL: 'email',
});
