import {
  createEntityAdapter,
  createSlice,
} from '@reduxjs/toolkit';
import { NOTIFICATIONS_MAX_CLIENT } from './notificationTypes.js';

/**
 * @typedef {Object} NotificationEntity
 * @property {string} id
 * @property {string} type
 * @property {string} category
 * @property {string} severity
 * @property {string} title
 * @property {string} message
 * @property {string} source
 * @property {string} timestamp
 * @property {boolean} read
 * @property {boolean} archived
 * @property {boolean} actionable
 * @property {Record<string, unknown>} [metadata]
 * @property {string[]} [deliveryChannels]
 * @property {string|null} [serverId]
 * @property {string|null} [viewedAt]
 * @property {string|null} [acknowledgedAt]
 * @property {string|null} [resolvedAt]
 */

const sortByTimestampDesc = (a, b) => {
  const ta = new Date(a.timestamp || 0).getTime();
  const tb = new Date(b.timestamp || 0).getTime();
  return tb - ta;
};

const notificationsAdapter = createEntityAdapter({
  sortComparer: sortByTimestampDesc,
});

const initialState = notificationsAdapter.getInitialState({
  /** @type {string|null} */
  syncCursor: null,
  /** @type {string|null} */
  lastSyncedAt: null,
});

function trimState(state) {
  const ids = state.ids;
  if (ids.length <= NOTIFICATIONS_MAX_CLIENT) return;

  const unreadIds = [];
  const readIds = [];
  ids.forEach((id) => {
    const e = state.entities[id];
    if (!e) return;
    if (!e.read && !e.archived) unreadIds.push(id);
    else readIds.push(id);
  });

  const maxRead = Math.max(0, NOTIFICATIONS_MAX_CLIENT - unreadIds.length);
  if (unreadIds.length + readIds.length <= NOTIFICATIONS_MAX_CLIENT) return;

  const readToRemove = readIds.slice(-Math.max(0, readIds.length - maxRead));
  if (readToRemove.length) {
    notificationsAdapter.removeMany(state, readToRemove);
  }

  const remaining = state.ids.length;
  if (remaining <= NOTIFICATIONS_MAX_CLIENT) return;
  const overflow = remaining - NOTIFICATIONS_MAX_CLIENT;
  const oldestUnread = unreadIds.slice(-overflow);
  if (oldestUnread.length) {
    notificationsAdapter.removeMany(state, oldestUnread);
  }
}

const { reducer, actions, name } = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    upsertOneNotification(state, action) {
      const entity = action.payload;
      if (!entity?.id) return;
      notificationsAdapter.upsertOne(state, entity);
      trimState(state);
    },
    upsertManyNotifications(state, action) {
      const list = action.payload;
      if (!Array.isArray(list) || !list.length) return;
      notificationsAdapter.upsertMany(state, list);
      trimState(state);
    },
    markRead(state, action) {
      const id = action.payload;
      const existing = state.entities[id];
      if (!existing) return;
      const now = new Date().toISOString();
      notificationsAdapter.updateOne(state, {
        id,
        changes: {
          read: true,
          viewedAt: existing.viewedAt || now,
        },
      });
    },
    markAllRead(state) {
      const now = new Date().toISOString();
      Object.keys(state.entities).forEach((id) => {
        const e = state.entities[id];
        if (!e || e.archived) return;
        notificationsAdapter.updateOne(state, {
          id,
          changes: {
            read: true,
            viewedAt: e.viewedAt || now,
          },
        });
      });
    },
    archiveNotification(state, action) {
      const id = action.payload;
      const existing = state.entities[id];
      if (!existing) return;
      notificationsAdapter.updateOne(state, {
        id,
        changes: { archived: true, read: true },
      });
    },
    hydrateFromServer(state, action) {
      const { items, cursor } = action.payload || {};
      if (Array.isArray(items) && items.length) {
        for (const serverEntity of items) {
          const dedup = serverEntity.metadata?.dedupKey;
          if (!dedup) continue;
          Object.keys(state.entities).forEach((entityId) => {
            const existing = state.entities[entityId];
            if (
              existing
              && existing.id !== serverEntity.id
              && existing.metadata?.dedupKey === dedup
            ) {
              notificationsAdapter.removeOne(state, entityId);
            }
          });
        }
        notificationsAdapter.upsertMany(state, items);
        trimState(state);
      }
      if (cursor !== undefined) {
        state.syncCursor = cursor;
      }
    },
    reconcileServerId(state, action) {
      const { clientId, serverId, patch } = action.payload || {};
      if (!clientId || !serverId) return;
      const existing = state.entities[clientId];
      if (!existing) return;
      notificationsAdapter.removeOne(state, clientId);
      notificationsAdapter.upsertOne(state, {
        ...existing,
        id: serverId,
        serverId,
        ...(patch || {}),
      });
    },
    markChannelDelivered(state, action) {
      const { id, channel } = action.payload || {};
      if (!id || !channel) return;
      const existing = state.entities[id];
      if (!existing) return;
      const meta = { ...(existing.metadata || {}) };
      const delivered = { ...(meta.delivered || {}) };
      delivered[channel] = true;
      meta.delivered = delivered;
      notificationsAdapter.updateOne(state, {
        id,
        changes: { metadata: meta },
      });
    },
    markLifecycle(state, action) {
      const { id, viewedAt, acknowledgedAt, resolvedAt } = action.payload || {};
      if (!id) return;
      const existing = state.entities[id];
      if (!existing) return;
      const changes = {};
      if (viewedAt !== undefined) changes.viewedAt = viewedAt;
      if (acknowledgedAt !== undefined) changes.acknowledgedAt = acknowledgedAt;
      if (resolvedAt !== undefined) changes.resolvedAt = resolvedAt;
      if (!Object.keys(changes).length) return;
      notificationsAdapter.updateOne(state, { id, changes });
    },
    resetNotifications() {
      return initialState;
    },
    /** Map temp id to server row after POST sync (optional). */
    applyServerIds(state, action) {
      const mappings = action.payload;
      if (!Array.isArray(mappings)) return;
      mappings.forEach(({ clientId, serverEntity }) => {
        if (!clientId || !serverEntity?.id) return;
        const existing = state.entities[clientId];
        if (existing) {
          notificationsAdapter.removeOne(state, clientId);
        }
        notificationsAdapter.upsertOne(state, serverEntity);
      });
    },
    setSyncCursor(state, action) {
      state.syncCursor = action.payload ?? null;
    },
    setLastSyncedAt(state, action) {
      state.lastSyncedAt = action.payload ?? null;
    },
  },
});

export const notificationsReducer = reducer;
export const notificationsActions = actions;
export const notificationsSliceName = name;
export { notificationsAdapter };
