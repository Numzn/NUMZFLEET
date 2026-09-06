import { CATEGORIES } from '../../notifications/contracts/notificationContract.js';

// Channels mirror the real CHANNELS enum in
// notifications/contracts/notificationContract.js, with 'inbox'+'websocket'
// collapsed into one user-facing 'inapp' toggle (both are the same in-app
// delivery surface from a preference standpoint).
export const NOTIFICATION_CHANNELS = ['inapp', 'email', 'sms', 'push'];

// Re-exported from the notification contract rather than kept as a parallel
// list — these are the same values policies set as entityType, and two copies
// could drift the moment a category is added.
export const NOTIFICATION_CATEGORIES = [...CATEGORIES];
