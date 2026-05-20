import { publishNotification } from '../../notifications/orchestrator/publishNotification.js';
import { CHANNELS } from '../../notifications/contracts/notificationContract.js';
import {
  buildTraccarNotificationCopy,
  resolveTraccarTrackingPolicy,
} from '../../notifications/policies/notificationPolicyService.js';
import { fetchTraccarEventsAfterCursor } from './traccarEventQuery.js';
import { getBridgeCursor, setBridgeCursor } from './bridgeStateRepository.js';
import { resolveTrackingEventAudience } from './audienceResolver.js';

function envEnabled() {
  const raw = process.env.TRACKING_NOTIFICATION_BRIDGE;
  return raw === '1' || raw === 'true';
}

/**
 * @param {import('socket.io').Server} [io]
 */
export async function pollAndPersistTrackingNotifications(io) {
  if (!envEnabled()) {
    return { processed: 0, persisted: 0, cursor: await getBridgeCursor() };
  }

  const cursor = await getBridgeCursor();
  const events = await fetchTraccarEventsAfterCursor({
    cursorId: cursor,
    batchSize: Number(process.env.TRACKING_BRIDGE_BATCH_SIZE) || 100,
    lookbackHours: Number(process.env.TRACKING_BRIDGE_LOOKBACK_HOURS) || 48,
  });

  if (!events.length) {
    return { processed: 0, persisted: 0, cursor };
  }

  let persisted = 0;

  for (const ev of events) {
    try {
      const policy = resolveTraccarTrackingPolicy({ type: ev.type, attributes: ev.attributes });
      if (!policy.persist) continue;

      const audienceIds = await resolveTrackingEventAudience(ev.deviceid, {
        respectGeofenceMute: true,
        traccarType: ev.type,
        attributes: ev.attributes,
      });
      if (!audienceIds.length) continue;

      const { title, message } = buildTraccarNotificationCopy(ev, policy);

      const result = await publishNotification({
        type: policy.notificationType,
        category: policy.category,
        severity: policy.severity,
        title,
        message,
        source: 'traccar',
        audience: { userIds: audienceIds },
        metadata: {
          traccarEventId: ev.id,
          deviceId: ev.deviceid,
          traccarType: ev.type,
          alarmAttr: ev.attributes?.alarm ?? null,
          dedupKey: `traccar:${ev.id}`,
          resolvedType: policy.resolvedType,
        },
        clientDedupKey: `traccar:${ev.id}`,
        channels: policy.channels.includes('push')
          ? [CHANNELS.INBOX, CHANNELS.WEBSOCKET, CHANNELS.PUSH]
          : [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
      }, { io });

      persisted += result.persisted || 0;
    } catch (e) {
      console.error('[tracking-bridge] event failed', ev?.id, e?.message || e);
    }
  }

  const maxId = events.reduce((m, e) => Math.max(m, Number(e.id) || 0), cursor);
  if (maxId > cursor) {
    await setBridgeCursor(maxId);
  }

  return {
    processed: events.length,
    persisted,
    cursor: maxId,
  };
}

export { envEnabled as isTrackingBridgeEnabled };
