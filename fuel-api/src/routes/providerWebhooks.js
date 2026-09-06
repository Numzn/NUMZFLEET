/**
 * Internal provider-status webhooks — receives delivery-lifecycle callbacks
 * from external notification providers (SMS gateway today; email/push have
 * no callback-capable provider currently in use, see ERB_INTEGRATION-style
 * docs note in the Phase 6 report). Server-to-server only: auth is a shared
 * secret, not a browser session. Mounted ahead of the app's normal
 * auth/session middleware, same as telemetryIngestion.js.
 */
import express from 'express';
import { requireSmsGatewayWebhookSecret } from '../middleware/smsGatewayWebhookAuth.js';
import { ingestSmsGatewayWebhook } from '../controllers/smsGatewayWebhookController.js';

const router = express.Router();

router.post('/sms-gateway', requireSmsGatewayWebhookSecret, ingestSmsGatewayWebhook);

export default router;
