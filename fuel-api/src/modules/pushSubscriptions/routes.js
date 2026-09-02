import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import * as ctrl from './pushSubscriptionsController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

router.get('/vapid-public-key', requireAuth, ctrl.getPublicKey);
router.get('/status', requireAuth, ctrl.getStatus);
router.post('/', requireAuth, ctrl.subscribe);
router.delete('/', requireAuth, ctrl.unsubscribe);

export default router;
