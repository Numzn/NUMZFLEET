const KEY_PREFIX = 'numz.notifications.lastSyncedAt';

export function getLastSyncedAt(userId) {
  if (userId == null || typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(`${KEY_PREFIX}:${userId}`);
  } catch {
    return null;
  }
}

export function setLastSyncedAt(userId, iso) {
  if (userId == null || typeof sessionStorage === 'undefined') return;
  try {
    if (iso) {
      sessionStorage.setItem(`${KEY_PREFIX}:${userId}`, iso);
    } else {
      sessionStorage.removeItem(`${KEY_PREFIX}:${userId}`);
    }
  } catch {
    /* ignore */
  }
}
