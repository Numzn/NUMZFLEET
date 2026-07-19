import { publishNotification } from './orchestrator/publishNotification.js';
import { getNotificationIo } from './notificationContext.js';
import { immobilizationTransitionPolicy } from './policies/notificationPolicyRegistry.js';

export function severityForStatus(status) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'critical';
  if (status === 'blocked' || status === 'cancelled' || status === 'expired') return 'warning';
  return 'info';
}

export function titleForIntent(intent, status) {
  const action = intent.action === 'mobilize' ? 'Mobilize' : 'Immobilize';
  if (status === 'completed') return `${action} command sent`;
  if (status === 'failed') return `${action} command failed`;
  if (status === 'blocked') return `${action} blocked by safety rules`;
  if (status === 'cancelled') return `${action} request cancelled`;
  if (status === 'expired') return `${action} request expired`;
  return `${action} update`;
}

/** Statuses that get a persisted, inbox-visible notification. */
export const PUBLISH_STATUS = ['completed', 'failed', 'blocked', 'cancelled', 'expired'];

/**
 * @param {object} intent serialized or row-like
 * @param {{ status?: string, executionError?: string|null }} [extra]
 */
export async function notifyImmobilizationTransition(intent, extra = {}) {
  if (!intent?.id) return;
  const status = extra.status || intent.status;
  if (!PUBLISH_STATUS.includes(status)) return;

  const title = titleForIntent(intent, status);
  const message = extra.executionError
    || intent.executionError
    || title;

  const at = new Date().toISOString();
  const io = getNotificationIo();

  if (PUBLISH_STATUS.includes(status)) {
    const policy = immobilizationTransitionPolicy({ intentId: intent.id, status });
    await publishNotification({
      type: policy.type,
      entityType: policy.entityType,
      entityId: String(intent.id),
      severity: policy.severity,
      title,
      message: String(message),
      source: 'fuel-api',
      audience: policy.audience,
      metadata: {
        intentId: intent.id,
        vehicleId: intent.vehicleId,
        deviceId: intent.deviceId,
        action: intent.action,
        status,
        confidence: intent.confidence,
        changedAt: at,
      },
      clientDedupKey: policy.clientDedupKey,
      channels: policy.channels,
    }, { io });
  }
}
