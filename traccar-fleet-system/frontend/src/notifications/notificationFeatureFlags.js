/**
 * Feature flags for unified notifications (migration / backward compatibility).
 * Default: unified engine ON unless explicitly disabled on server or legacy UI on user.
 */

/** @param {import('redux').UnknownAction} state */
export function isUnifiedNotificationsEnabled(state) {
  try {
    const user = state?.session?.user;
    const server = state?.session?.server;
    if (user?.attributes?.legacyNotificationUi === true) {
      return false;
    }
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LEGACY_NOTIFICATION_UI === 'true') {
      return false;
    }
    if (server?.attributes?.unifiedNotifications === false) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/** When true, client hydrates and PATCHes persisted rows from fuel-api. */
export function isNotificationPersistenceSyncEnabled(state) {
  if (!isUnifiedNotificationsEnabled(state)) return false;
  const server = state?.session?.server;
  if (server?.attributes?.notificationPersistenceSync === false) {
    return false;
  }
  return true;
}

/**
 * When true, Traccar WS events are still ingested into the bell slice client-side.
 * When server persistence bridge is on, set trackingBellIngest=false to avoid double-ingest.
 */
export function isTraccarBellIngestEnabled(state) {
  if (!isUnifiedNotificationsEnabled(state)) return false;
  const server = state?.session?.server;
  if (server?.attributes?.trackingBellIngest === true) {
    return true;
  }
  if (server?.attributes?.trackingBellIngest === false) {
    return false;
  }
  if (server?.attributes?.trackingNotificationPersist === true) {
    return false;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TRACKING_BELL_INGEST === 'true') {
    return true;
  }
  return false;
}
