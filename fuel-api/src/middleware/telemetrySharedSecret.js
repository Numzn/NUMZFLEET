import crypto from 'crypto';

/**
 * Server-to-server auth for Traccar's event.forward.* webhook — there's no
 * browser session here, so the usual authenticate/requireAuth chain doesn't
 * apply. Traccar sends the secret via event.forward.header.
 */
export function requireTelemetrySecret(req, res, next) {
  const expected = process.env.TELEMETRY_INGEST_SECRET;
  if (!expected) {
    console.error('[telemetry] TELEMETRY_INGEST_SECRET is not configured; rejecting ingestion request');
    return res.status(503).json({ error: 'Telemetry ingestion not configured' });
  }

  const provided = req.get('x-telemetry-secret') || '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  const match = expectedBuf.length === providedBuf.length
    && crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!match) {
    return res.status(401).json({ error: 'Invalid telemetry secret' });
  }

  next();
}
