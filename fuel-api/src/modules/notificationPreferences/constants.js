// Categories mirror the real entityType values already used across
// fuel-api/src/notifications/policies/notificationPolicyRegistry.js — not
// invented generic ones. Channels mirror the real CHANNELS enum in
// notifications/contracts/notificationContract.js, with 'inbox'+'websocket'
// collapsed into one user-facing 'inapp' toggle (both are the same in-app
// delivery surface from a preference standpoint).
export const NOTIFICATION_CHANNELS = ['inapp', 'email', 'sms', 'push'];

export const NOTIFICATION_CATEGORIES = [
  'fuel',
  'tracking',
  'maintenance',
  'compliance',
  'security',
  'assignment',
  'vehicle',
  'system',
];
