import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAuth, requireManager } from '../middleware/authGates.js';
import { attachTenantContext } from '../middleware/tenantContext.js';
import { getFleetCommandCenter } from '../controllers/fleetCommandController.js';
import {
  getDashboard,
  getBudget,
  putBudget,
} from '../controllers/maintenanceController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);
router.get('/command-center', requireAuth, requireManager, getFleetCommandCenter);
router.get('/maintenance/dashboard', requireAuth, requireManager, getDashboard);
router.get('/maintenance/budget', requireAuth, requireManager, getBudget);
router.put('/maintenance/budget', requireAuth, requireManager, putBudget);

export default router;
