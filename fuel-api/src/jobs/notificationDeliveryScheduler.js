import { runDeliveryWorkerOnce } from '../notifications/delivery/deliveryWorker.js';
import {
  markWorkerStarted,
  markWorkerStopped,
  markTick,
  markTickError,
} from '../notifications/delivery/deliveryWorkerStatus.js';
import { runIntervalJob } from './schedulerRuntime.js';
import { LOCK_KEYS } from './lockKeys.js';

/**
 * Drives the asynchronous notification delivery worker.
 *
 * Reuses runIntervalJob rather than introducing a queue: its in-process
 * `tickInFlight` guard plus the Postgres advisory lock together mean at most
 * one delivery tick runs at a time across every fuel-api process. That is the
 * first of the two concurrency layers — the second is the transactional claim
 * in claimDueDeliveries, which is what actually makes double-processing
 * impossible even if the lock were lost.
 *
 * Interval is short (10s by default) because this is user-facing latency:
 * publish now returns immediately and the worker is what actually sends. The
 * batch limit keeps one slow provider from monopolising a tick.
 */
const INTERVAL_MS = Number(process.env.NOTIFICATION_DELIVERY_POLL_MS || 10000);
const BATCH_LIMIT = Number(process.env.NOTIFICATION_DELIVERY_BATCH || 25);
// Deliveries only exist once something publishes, so there is no value in
// racing the rest of startup.
const STARTUP_DELAY_MS = Number(process.env.NOTIFICATION_DELIVERY_STARTUP_MS || 15000);

function isEnabled() {
  const raw = String(process.env.NOTIFICATION_DELIVERY_WORKER ?? '1').toLowerCase();
  return raw === '1' || raw === 'true';
}

export function startNotificationDeliveryScheduler() {
  if (!isEnabled()) {
    // This is load-bearing: with the worker off, push/SMS/email deliveries are
    // still created and simply accumulate as pending forever. Warn loudly at
    // startup and mark the status degraded so /health cannot report a system
    // that silently delivers nothing as fully healthy.
    markWorkerStarted({ enabled: false, intervalMs: INTERVAL_MS });
    console.warn(
      '[notification-delivery] WORKER DISABLED (NOTIFICATION_DELIVERY_WORKER=0) — '
      + 'push/SMS/email deliveries will be recorded as pending and never sent. '
      + 'In-app and websocket notifications are unaffected.',
    );
    return () => { markWorkerStopped(); };
  }

  markWorkerStarted({ enabled: true, intervalMs: INTERVAL_MS });

  const stop = runIntervalJob({
    name: 'notification-delivery',
    intervalMs: INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
    lockKey: LOCK_KEYS.NOTIFICATION_DELIVERY,
    task: async () => {
      try {
        const result = await runDeliveryWorkerOnce({ limit: BATCH_LIMIT });
        markTick({ claimed: result.claimed });
        // Only log ticks that did something — a quiet system should stay quiet.
        if (result.claimed || result.recovered) {
          console.log(JSON.stringify({
            event: 'notification-delivery.tick',
            ...result,
            ts: new Date().toISOString(),
          }));
        }
      } catch (error) {
        // A tick that throws (e.g. the database went away) must be visible in
        // /health rather than only in the logs. runIntervalJob catches and logs
        // too, so this re-throw is not needed — recording is enough.
        markTickError(error);
        throw error;
      }
    },
  });

  return () => {
    stop();
    markWorkerStopped();
    console.log('[notification-delivery] worker stopped; any in-flight delivery '
      + 'is left for stale-lock recovery');
  };
}
