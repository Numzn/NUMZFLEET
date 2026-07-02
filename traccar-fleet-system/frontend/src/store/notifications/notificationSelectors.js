import { createSelector } from '@reduxjs/toolkit';
import { notificationsAdapter } from './notificationsSlice.js';

const selectNotificationsState = (state) => state.notifications;

const adapterSelectors = notificationsAdapter.getSelectors(selectNotificationsState);

export const selectNotificationIds = adapterSelectors.selectIds;
export const selectNotificationEntities = adapterSelectors.selectEntities;
export const selectAllNotifications = adapterSelectors.selectAll;
export const selectNotificationById = adapterSelectors.selectById;

export const selectUnreadCount = createSelector(
  [selectAllNotifications],
  (all) => all.filter((n) => !n.read && !n.archived).length,
);

export const selectArchivedCount = createSelector(
  [selectAllNotifications],
  (all) => all.filter((n) => n.archived).length,
);

/**
 * @param {import('./notificationsSlice.js').NotificationEntity} n
 * @param {{ category?: string, severity?: string, read?: 'all'|'read'|'unread', archived?: boolean }} filters
 */
function matchesFilters(n, filters) {
  if (!filters) return true;
  if (filters.category && n.category !== filters.category) return false;
  if (filters.severity && n.severity !== filters.severity) return false;
  if (filters.archived === true && !n.archived) return false;
  if (filters.archived === false && n.archived) return false;
  if (filters.read === 'read' && !n.read) return false;
  if (filters.read === 'unread' && n.read) return false;
  return true;
}

/**
 * Factory — call once per component instance (inside useMemo) so each
 * instance gets its own memoization cache.
 */
export const makeSelectNotificationsWithFilters = () => createSelector(
  [selectAllNotifications, (_, filters) => filters],
  (all, filters) => {
    if (!filters) return all;
    return all.filter((n) => matchesFilters(n, filters));
  },
);

export const makeSelectGroupedByDayBucket = () => createSelector(
  [selectAllNotifications, (_, filters) => filters],
  (all, filters) => {
    const list = filters ? all.filter((n) => matchesFilters(n, filters)) : all;
    const groups = {};
    list.forEach((n) => {
      const d = (n.timestamp || '').slice(0, 10) || 'unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(n);
    });
    return groups;
  },
);

/** Legacy non-memoized helpers kept for any one-off call sites outside hooks. */
export function selectNotificationsWithFilters(state, filters) {
  const all = selectAllNotifications(state);
  if (!filters) return all;
  return all.filter((n) => matchesFilters(n, filters));
}

export function selectGroupedByDayBucket(state, filters) {
  return makeSelectGroupedByDayBucket()(state, filters);
}

export const selectGroupedByCategory = createSelector(
  [selectAllNotifications],
  (all) => {
    const groups = {};
    all.forEach((n) => {
      const c = n.category || 'system';
      if (!groups[c]) groups[c] = [];
      groups[c].push(n);
    });
    return groups;
  },
);

export const makeSelectGroupedByCategory = () => createSelector(
  [selectAllNotifications, (_, filters) => filters],
  (all, filters) => {
    const list = filters ? all.filter((n) => matchesFilters(n, filters)) : all;
    const groups = {};
    list.forEach((n) => {
      const c = n.category || 'system';
      if (!groups[c]) groups[c] = [];
      groups[c].push(n);
    });
    return groups;
  },
);

export const makeSelectGroupedByVehicle = () => createSelector(
  [selectAllNotifications, (_, filters) => filters],
  (all, filters) => {
    const list = filters ? all.filter((n) => matchesFilters(n, filters)) : all;
    const groups = {};
    list.forEach((n) => {
      const key = n.metadata?.vehicleId != null
        ? `Vehicle ${n.metadata.vehicleId}`
        : (n.metadata?.deviceId != null ? `Device ${n.metadata.deviceId}` : 'General');
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  },
);
