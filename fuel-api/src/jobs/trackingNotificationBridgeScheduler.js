import { pollAndPersistTrackingNotifications, isTrackingBridgeEnabled } from '../integrations/traccarBridge/trackingNotificationService.js';

let tickInFlight = false;
let intervalRef = null;

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

  const pollMs = Math.max(5000, Number(process.env.TRACKING_BRIDGE_POLL_MS) || 15000);

  const tick = async () => {
    if (tickInFlight) return;
    tickInFlight = true;
    try {
      const result = await pollAndPersistTrackingNotifications(io);
      if (process.env.NODE_ENV === 'development' && result.processed > 0) {
        console.log('[tracking-bridge]', result);
      }
    } catch (e) {
      console.error('[tracking-bridge] poll failed', e?.message || e);
    } finally {
      tickInFlight = false;
    }
  };

  void tick();
  intervalRef = setInterval(tick, pollMs);

  return () => {
    if (intervalRef) {
      clearInterval(intervalRef);
      intervalRef = null;
    }
  };
}
