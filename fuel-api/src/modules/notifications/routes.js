import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import * as ctrl from './notificationController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

router.get('/sync', requireAuth, ctrl.syncNotifications);
// Declared before the /:id routes so 'delivery-stats' is not read as an id.
router.get('/delivery-stats', requireAuth, ctrl.getDeliveryStats);
router.get('/', requireAuth, ctrl.listNotifications);
router.patch('/read-all', requireAuth, ctrl.patchReadAll);
router.patch('/:id/read', requireAuth, ctrl.patchRead);
router.patch('/:id/lifecycle', requireAuth, ctrl.patchLifecycle);
router.post('/escalate', requireAuth, ctrl.postEscalate);
router.delete('/:id', requireAuth, ctrl.removeOne);

export default router;
