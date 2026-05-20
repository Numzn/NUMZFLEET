import * as repo from '../../modules/notifications/notificationRepository.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { resolveAudience } from './audienceResolver.js';
import { dispatchNotificationChannels } from '../dispatcher/notificationDispatcher.js';

/**
 * Central notification publish API.
 * @param {import('../contracts/notificationContract.js').PublishNotificationSpec} spec
 * @param {{ io?: import('socket.io').Server }} [ctx]
 */
export async function publishNotification(spec, ctx = {}) {
  const {
    type,
    category,
    severity,
    title,
    message,
    source = 'fuel-api',
    audience,
    metadata = {},
    clientDedupKey,
    channels = [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
  } = spec;

  const userIds = await resolveAudience(audience);
  if (!userIds.length) {
    return { userIds: [], persisted: 0 };
  }

  const rows = userIds.map((userId) => ({
    userId,
    type,
    category,
    severity,
    title,
    message,
    source,
    metadata,
    read: false,
    archived: false,
    clientDedupKey: clientDedupKey ? `${userId}:${clientDedupKey}` : null,
  }));

  let persistedApiRows = [];
  if (channels.includes(CHANNELS.INBOX) && rows.length) {
    persistedApiRows = await repo.persistNotificationRows(rows);
  }

  const apiByUserDedup = new Map();
  for (const apiRow of persistedApiRows) {
    if (apiRow?.userId != null && apiRow.clientDedupKey) {
      apiByUserDedup.set(`${apiRow.userId}:${apiRow.clientDedupKey}`, apiRow);
    }
  }

  const { io } = ctx;
  const realtimeChannels = channels.filter((c) => c !== CHANNELS.INBOX);
  if (realtimeChannels.length && io) {
    for (const row of rows) {
      const apiRow = apiByUserDedup.get(`${row.userId}:${row.clientDedupKey}`);
      if (!apiRow?.id) continue;
      await dispatchNotificationChannels(io, row.userId, {
        ...apiRow,
        clientDedupKey: row.clientDedupKey,
      }, realtimeChannels);
    }
  }

  return { userIds, persisted: persistedApiRows.length };
}
