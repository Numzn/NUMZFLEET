import { notificationsActions } from '../store/notifications/notificationsSlice.js';
import {
  syncNotificationsSince,
  mapServerNotificationToEntity,
} from './notificationApi.js';
import { getLastSyncedAt, setLastSyncedAt } from './notificationSyncStorage.js';

/** @type {Map<string|number, boolean>} */
const syncInFlightByUser = new Map();

/**
 * Incremental inbox sync from fuel-api (fuel + persisted tracking).
 * @param {import('@reduxjs/toolkit').Dispatch} dispatch
 * @param {{ id: number|string }} user
 * @param {boolean} persistenceEnabled
 */
export async function runNotificationSync(dispatch, user, persistenceEnabled) {
  if (!persistenceEnabled || !user?.id) return;
  if (syncInFlightByUser.get(user.id)) return;
  syncInFlightByUser.set(user.id, true);
  try {
    const since = getLastSyncedAt(user.id);
    const json = await syncNotificationsSince({ since: since || undefined, limit: 100 });
    const rows = json?.items || [];
    const mapped = rows.map(mapServerNotificationToEntity).filter(Boolean);
    if (mapped.length) {
      dispatch(notificationsActions.hydrateFromServer({ items: mapped, cursor: null }));
    }
    const nextSync = json?.nextSyncFrom || json?.serverTime || new Date().toISOString();
    setLastSyncedAt(user.id, nextSync);
    dispatch(notificationsActions.setLastSyncedAt(nextSync));
  } catch (e) {
    console.warn('[notificationSync] failed', e);
  } finally {
    syncInFlightByUser.delete(user.id);
  }
}
