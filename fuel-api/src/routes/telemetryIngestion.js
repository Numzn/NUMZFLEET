/**
 * Internal telemetry ingestion — receives Traccar's event.forward.url webhook.
 * Server-to-server only: auth is a shared secret (x-telemetry-secret), not a
 * browser session. Mounted ahead of the app's normal auth/session middleware.
 */
import express from 'express';
import { requireTelemetrySecret } from '../middleware/telemetrySharedSecret.js';
import { ingestTraccarEvent } from '../controllers/telemetryIngestionController.js';

const router = express.Router();

router.post('/traccar-events', requireTelemetrySecret, ingestTraccarEvent);

export default router;
