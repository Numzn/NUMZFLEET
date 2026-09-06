import crypto from 'crypto';

/**
 * Server-to-server auth for the SMS gateway's own webhook callbacks
 * (sms:sent/delivered/failed/cancelled) — same shape as
 * telemetrySharedSecret.js's requireTelemetrySecret (constant-time shared-
 * secret header comparison), deliberately not reused directly: that
 * middleware is telemetry's own secret/header pair, and conflating the two
 * would mean rotating one credential silently affects the other integration.
 *
 * The gateway itself does not sign or otherwise authenticate its webhook
 * requests (verified against its real docs — no signature header, no
 * mutual TLS), so a shared secret we choose and configure into the gateway's
 * own webhook registration (the `url` we register carries it, e.g. as a
 * query parameter or a custom header depending on what the registration
 * call supports) is the mechanism available. Fails closed (503) if
 * unconfigured, matching every other provider's isConfigured() guard in this
 * codebase.
 */
export function requireSmsGatewayWebhookSecret(req, res, next) {
  const expected = process.env.SMS_GATEWAY_WEBHOOK_SECRET;
  if (!expected) {
    console.error('[sms-gateway-webhook] SMS_GATEWAY_WEBHOOK_SECRET is not configured; rejecting webhook request');
    return res.status(503).json({ error: 'SMS gateway webhook ingestion not configured' });
  }

  const provided = req.get('x-sms-gateway-webhook-secret') || '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  const match = expectedBuf.length === providedBuf.length
    && crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!match) {
    return res.status(401).json({ error: 'Invalid SMS gateway webhook secret' });
  }

  next();
}
