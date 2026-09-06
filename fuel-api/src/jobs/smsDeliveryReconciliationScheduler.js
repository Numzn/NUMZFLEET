import { reconcileStaleSmsDeliveries } from '../notifications/delivery/smsReconciliation.js';
import { isSmsGatewayConfigured } from '../notifications/providers/smsProvider.js';
import { runIntervalJob } from './schedulerRuntime.js';
import { LOCK_KEYS } from './lockKeys.js';

/**
 * The Step 5/6 safety net alongside the SMS gateway webhook (see
 * routes/providerWebhooks.js): a bounded, infrequent status-lookup sweep for
 * SMS deliveries stuck at SENT — covers a lost/delayed webhook, a webhook
 * never registered yet, or the gateway retrying delivery of an event we
 * genuinely never received. Not a substitute for the webhook (which is the
 * primary, low-latency path once registered) and not continuous polling of
 * every delivery — only durable candidates the reconciliation query itself
 * already scopes tightly (channel=sms, status=sent, past the staleness
 * threshold), bounded per tick.
 *
 * Long interval and long staleness threshold on purpose: this exists for the
 * slow, exceptional path, not as a second delivery worker. A delivery that
 * confirms promptly via the webhook never becomes a candidate here at all
 * (it leaves SENT before it is ever stale enough to match).
 */
const INTERVAL_MS = Number(process.env.SMS_RECONCILIATION_POLL_MS || 5 * 60 * 1000);
const STALE_AFTER_MS = Number(process.env.SMS_RECONCILIATION_STALE_AFTER_MS || 15 * 60 * 1000);
const BATCH_LIMIT = Number(process.env.SMS_RECONCILIATION_BATCH || 20);
const STARTUP_DELAY_MS = Number(process.env.SMS_RECONCILIATION_STARTUP_MS || 60000);

function isEnabled() {
  const raw = String(process.env.SMS_DELIVERY_RECONCILIATION ?? '1').toLowerCase();
  return (raw === '1' || raw === 'true') && isSmsGatewayConfigured();
}

export function startSmsDeliveryReconciliationScheduler() {
  if (!isEnabled()) {
    // Not load-bearing the way the delivery worker's own disabled state is:
    // SMS still sends normally without this running, it just stays at SENT
    // forever if a webhook is lost. Quiet by design — this is a secondary
    // safety net, not the primary delivery path.
    return () => {};
  }

  return runIntervalJob({
    name: 'sms-delivery-reconciliation',
    intervalMs: INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
    lockKey: LOCK_KEYS.SMS_DELIVERY_RECONCILIATION,
    task: async () => {
      const summary = await reconcileStaleSmsDeliveries({
        limit: BATCH_LIMIT,
        staleAfterMs: STALE_AFTER_MS,
      });
      if (summary.checked) {
        console.log(JSON.stringify({
          event: 'sms-delivery-reconciliation.tick', ...summary, ts: new Date().toISOString(),
        }));
      }
    },
  });
}
