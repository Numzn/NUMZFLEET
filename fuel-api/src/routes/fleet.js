import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAuth, requireManager } from '../middleware/authGates.js';
import { attachTenantContext } from '../middleware/tenantContext.js';
import { getFleetCommandCenter } from '../controllers/fleetCommandController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);
router.get('/command-center', requireAuth, requireManager, getFleetCommandCenter);

export default router;
