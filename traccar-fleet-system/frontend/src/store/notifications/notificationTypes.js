/**
 * Canonical notification domain constants (unified notification system).
 */

/** @typedef {'fuel'|'tracking'|'security'|'maintenance'|'assignment'|'system'} NotificationCategory */
/** @typedef {'info'|'success'|'warning'|'critical'} NotificationSeverity */
/** @typedef {'traccar'|'fuel-api'} NotificationSource */

export const NOTIFICATION_CATEGORIES = Object.freeze([
  'fuel',
  'tracking',
  'security',
  'maintenance',
  'assignment',
  'system',
]);

export const SEVERITY = Object.freeze({
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'critical',
});

export const SOURCES = Object.freeze({
  TRACCAR: 'traccar',
  FUEL_API: 'fuel-api',
});

export const DELIVERY_CHANNELS = Object.freeze({
  TOAST: 'toast',
  NOTIFICATION_CENTER: 'notificationCenter',
  BROWSER_PUSH: 'browserPush',
  SOUND: 'sound',
});

/** Max entities kept client-side before trim (newest retained). */
export const NOTIFICATIONS_MAX_CLIENT = 200;
