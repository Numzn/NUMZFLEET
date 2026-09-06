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
 * @property {string} [urgency] how fast this must reach someone; derived from
 *   severity when a policy does not state one (see resolveUrgency)
 * @property {Record<string, unknown>} [metadata]
 * @property {('inbox'|'websocket'|'push'|'sms'|'email')[]} [channels]
 * @property {boolean} [mandatory] Phase 5: when true, the delivery planner
 *   may override an explicit channel opt-out and a quiet-hours hold for this
 *   notification. Never overrides channel eligibility (no policy can invent a
 *   phone number that isn't there). Defaults to false/unset — no existing
 *   policy sets this; "critical severity" alone must never imply it (see
 *   canonicalNotification.js's severity/urgency independence).
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
 * @property {'immediate'|'normal'|'deferred'} urgency
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

/**
 * In-app delivery is always this pair: the durable inbox row plus the live
 * socket emit. Exported here (rather than redefined per registry) so both
 * policy registries express "in-app" the same way — the Traccar registry
 * previously said 'bell' for the same concept.
 */
export const IN_APP_CHANNELS = Object.freeze([CHANNELS.INBOX, CHANNELS.WEBSOCKET]);

/**
 * How serious the event is. Describes the event itself, never how fast it
 * must travel — that is URGENCY. Kept at the four values already in use
 * across the codebase and persisted in notifications.severity.
 */
export const SEVERITY = Object.freeze({
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'critical',
});

/**
 * How fast the notification must reach a human. Deliberately separate from
 * SEVERITY: a critical event that is already resolved may not be urgent, and
 * a merely-informational one (an expiring window) can be. Nothing consumes
 * this for channel selection yet — that arrives with the delivery planner in
 * a later phase; this phase only establishes and persists the vocabulary.
 */
export const URGENCY = Object.freeze({
  IMMEDIATE: 'immediate',
  NORMAL: 'normal',
  DEFERRED: 'deferred',
});

/**
 * The canonical category vocabulary — the same values policies set as
 * entityType and the Settings preference matrix renders as rows. Single
 * source of truth; notificationPreferences/constants.js imports this rather
 * than keeping a parallel copy that could drift.
 */
export const CATEGORIES = Object.freeze([
  'fuel',
  'tracking',
  'maintenance',
  'compliance',
  'security',
  'assignment',
  'vehicle',
  'system',
]);
