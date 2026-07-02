import * as repo from '../../modules/notifications/notificationRepository.js';
import { CHANNELS } from '../contracts/notificationContract.js';
import { DEFAULT_COMPANY_ID } from '../../models/index.js';
import { resolveAudience } from './audienceResolver.js';
import { dispatchNotificationChannels } from '../dispatcher/notificationDispatcher.js';
import { createNotification } from '../canonicalNotification.js';

/**
 * Central notification publish API.
 * @param {import('../contracts/notificationContract.js').PublishNotificationSpec} spec
 * @param {{ io?: import('socket.io').Server }} [ctx]
 */
export async function publishNotification(spec, ctx = {}) {
  const notification = createNotification(spec);
  const {
    type,
    category,
    severity,
    title,
    message,
    source,
    audience,
    metadata,
    clientDedupKey,
    channels = [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
  } = notification;

  const userIds = await resolveAudience(audience);
  if (!userIds.length) {
    return { userIds: [], persisted: 0 };
  }

  const now = new Date();
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
    tenantId: spec.companyId || metadata?.companyId || DEFAULT_COMPANY_ID,
    clientDedupKey: `${userId}:${clientDedupKey}`,
    createdAt: now,
    updatedAt: now,
  }));

  let persistedApiRows = [];
  if (channels.includes(CHANNELS.INBOX) && rows.length) {
    persistedApiRows = await repo.persistNotificationRows(rows);
  }

  const persistedByUserDedup = new Map();
  for (const apiRow of persistedApiRows) {
    if (apiRow?.userId != null && apiRow.clientDedupKey) {
      persistedByUserDedup.set(`${apiRow.userId}:${apiRow.clientDedupKey}`, apiRow);
    }
  }

  const { io } = ctx;
  const realtimeChannels = channels.filter((c) => c !== CHANNELS.INBOX);
  if (realtimeChannels.length && io) {
    for (const row of rows) {
      const apiRow = persistedByUserDedup.get(`${row.userId}:${row.clientDedupKey}`);
      if (!apiRow?.id) {
        console.warn('[notifications] skip websocket emit: no persisted row', {
          type,
          userId: row.userId,
          clientDedupKey: row.clientDedupKey,
        });
        continue;
      }
      await dispatchNotificationChannels(io, row.userId, apiRow, realtimeChannels);
    }
  }

  return { userIds, persisted: persistedApiRows.length };
}
