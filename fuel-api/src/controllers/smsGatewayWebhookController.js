import { parseWebhookPayload } from '../notifications/delivery/providerAdapters/smsGatewayAdapter.js';
import { applyProviderEvent } from '../notifications/delivery/deliveryLifecycleService.js';

/**
 * POST /internal/provider-webhooks/sms-gateway
 *
 * The gateway requires a 2xx within 30s or it retries (its own documented
 * behavior) — so every outcome that we genuinely handled, including ones we
 * deliberately did nothing with (an unknown event, a stale/duplicate
 * callback, an event for a delivery we have no record of), must still 2xx:
 * retrying any of those changes nothing and would just repeat forever. Only
 * a request we could not even parse gets a 4xx, since that is the one case
 * where telling the sender something is wrong is actually useful.
 */
export async function ingestSmsGatewayWebhook(req, res) {
  const parsed = parseWebhookPayload(req.body);

  if (!parsed.ok) {
    if (parsed.reason === 'unknown_event') {
      // A real, well-formed event we do not act on (e.g. an inbound
      // sms:received) — not an error, just nothing to do.
      return res.status(200).json({ received: true, handled: false, reason: parsed.reason });
    }
    console.warn('[sms-gateway-webhook] rejected malformed request', { reason: parsed.reason });
    return res.status(400).json({ error: 'Malformed webhook payload', reason: parsed.reason });
  }

  let result;
  try {
    result = await applyProviderEvent(parsed.event);
  } catch (error) {
    // A real processing failure (e.g. the database is down). This is the one
    // case where letting the gateway's own retry policy work in our favor is
    // correct — a 5xx here is honest, not a bug to hide.
    console.error('[sms-gateway-webhook] failed to process event', {
      provider: parsed.event.provider,
      providerMessageId: parsed.event.providerMessageId,
      message: error?.message || String(error),
    });
    return res.status(500).json({ error: 'Failed to process webhook' });
  }

  console.log(JSON.stringify({
    event: 'sms-gateway-webhook.processed',
    ...result,
    ts: new Date().toISOString(),
  }));

  return res.status(200).json({ received: true, handled: true, outcome: result.outcome });
}
