import { escalateOverdueNotifications } from '../notifications/escalation/notificationEscalationService.js';
import { runIntervalJob } from './schedulerRuntime.js';
import { LOCK_KEYS } from './lockKeys.js';

/**
 * Phase 7: automatic escalation for mandatory, immediate-urgency
 * notifications nobody has acknowledged yet. Polls on the partial index
 * added in 20260906_notification_escalation.sql rather than any push/event
 * path — escalation is inherently about the passage of time (an ack that
 * never happened), which only a poll can observe.
 *
 * Interval is modest (1 minute) relative to the delivery worker's 10s: the
 * escalation threshold itself is minutes long, so a further ~1 minute of
 * scheduling jitter before a stale notification is even looked at is
 * immaterial, and there is no value in polling this table any harder.
 */
const INTERVAL_MS = Number(process.env.NOTIFICATION_ESCALATION_POLL_MS || 60 * 1000);
const ESCALATE_AFTER_MS = Number(process.env.NOTIFICATION_ESCALATION_AFTER_MS || 10 * 60 * 1000);
const BATCH_LIMIT = Number(process.env.NOTIFICATION_ESCALATION_BATCH || 20);
const STARTUP_DELAY_MS = Number(process.env.NOTIFICATION_ESCALATION_STARTUP_MS || 30000);

function isEnabled() {
  const raw = String(process.env.NOTIFICATION_ESCALATION_ENABLED ?? '1').toLowerCase();
  return raw === '1' || raw === 'true';
}

export function startNotificationEscalationScheduler() {
  if (!isEnabled()) {
    // Not load-bearing for delivery itself: with this off, mandatory
    // notifications still deliver normally on publish — they simply never
    // get a follow-up reminder if nobody acknowledges them.
    return () => {};
  }

  return runIntervalJob({
    name: 'notification-escalation',
    intervalMs: INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
    lockKey: LOCK_KEYS.NOTIFICATION_ESCALATION,
    task: async () => {
      const summary = await escalateOverdueNotifications({
        limit: BATCH_LIMIT,
        escalateAfterMs: ESCALATE_AFTER_MS,
      });
      if (summary.checked) {
        console.log(JSON.stringify({
          event: 'notification-escalation.tick', ...summary, ts: new Date().toISOString(),
        }));
      }
    },
  });
}
