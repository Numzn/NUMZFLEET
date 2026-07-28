import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import * as ctrl from './notificationPreferencesController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

router.get('/', requireAuth, ctrl.getPreferences);
router.put('/', requireAuth, ctrl.putPreferences);

export default router;
