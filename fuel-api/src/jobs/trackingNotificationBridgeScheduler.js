import { pollAndPersistTrackingNotifications, isTrackingBridgeEnabled } from '../integrations/traccarBridge/trackingNotificationService.js';
import { runIntervalJob } from './schedulerRuntime.js';

/**
 * Poll Traccar tc_events for persist-worthy tracking notifications.
 *
 * Env:
 *   TRACKING_NOTIFICATION_BRIDGE=1
 *   TRACKING_BRIDGE_POLL_MS (default 15000)
 * @param {import('socket.io').Server} [io]
 */
export function startTrackingNotificationBridgeScheduler(io) {
  if (!isTrackingBridgeEnabled()) {
    return () => {};
  }

  const intervalMs = Math.max(5000, Number(process.env.TRACKING_BRIDGE_POLL_MS) || 15000);

  const task = async () => {
    const started = Date.now();
    const result = await pollAndPersistTrackingNotifications(io);
    const ms = Date.now() - started;
    if (result.processed > 0 || result.persisted > 0) {
      console.log('[tracking-bridge] poll', {
        processed: result.processed,
        persisted: result.persisted,
        cursor: result.cursor,
        ms,
      });
    }
  };

  return runIntervalJob({ name: 'tracking-bridge', intervalMs, task });
}
