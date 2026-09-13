import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth, requireManager } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import * as ctrl from './driverController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

router.get('/', requireAuth, requireManager, ctrl.listDrivers);
router.post('/', requireAuth, requireManager, ctrl.createDriver);
router.get('/:driverId', requireAuth, requireManager, ctrl.getDriver);
router.patch('/:driverId', requireAuth, requireManager, ctrl.updateDriver);
router.delete('/:driverId', requireAuth, requireManager, ctrl.deleteDriver);

export default router;
