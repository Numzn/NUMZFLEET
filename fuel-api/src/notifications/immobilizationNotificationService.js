import { publishNotification } from './orchestrator/publishNotification.js';
import { CHANNELS } from './contracts/notificationContract.js';
import { getNotificationIo } from './notificationContext.js';

function severityForStatus(status) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'critical';
  if (status === 'blocked' || status === 'cancelled' || status === 'expired') return 'warning';
  return 'info';
}

function titleForIntent(intent, status) {
  const action = intent.action === 'mobilize' ? 'Mobilize' : 'Immobilize';
  if (status === 'completed') return `${action} command sent`;
  if (status === 'failed') return `${action} command failed`;
  if (status === 'blocked') return `${action} blocked by safety rules`;
  if (status === 'cancelled') return `${action} request cancelled`;
  if (status === 'expired') return `${action} request expired`;
  return `${action} update`;
}

/**
 * @param {object} intent serialized or row-like
 * @param {{ status?: string, executionError?: string|null }} [extra]
 */
export async function notifyImmobilizationTransition(intent, extra = {}) {
  if (!intent?.id) return;
  const status = extra.status || intent.status;
  const publishStatus = ['completed', 'failed', 'blocked', 'cancelled'];
  const realtimeStatus = ['completed', 'failed', 'cancelled', 'expired'];
  if (!publishStatus.includes(status) && !realtimeStatus.includes(status)) return;

  const severity = severityForStatus(status);
  const title = titleForIntent(intent, status);
  const message = extra.executionError
    || intent.executionError
    || title;

  const at = new Date().toISOString();
  const io = getNotificationIo();

  if (publishStatus.includes(status)) {
    await publishNotification({
      type: `immobilization.${status}`,
      entityType: 'security',
      entityId: String(intent.id),
      severity,
      title,
      message: String(message),
      source: 'fuel-api',
      audience: { managers: true },
      metadata: {
        intentId: intent.id,
        vehicleId: intent.vehicleId,
        deviceId: intent.deviceId,
        action: intent.action,
        status,
        confidence: intent.confidence,
        changedAt: at,
      },
      clientDedupKey: `immobilization:${intent.id}:${status}`,
      channels: [CHANNELS.INBOX, CHANNELS.WEBSOCKET],
    }, { io });
  }

  if (realtimeStatus.includes(status) && io) {
    io.to('managers').emit('immobilization.updated', {
      intentId: intent.id,
      vehicleId: intent.vehicleId,
      status,
      confidence: intent.confidence,
      updatedAt: intent.updatedAt || at,
    });
  }
}
