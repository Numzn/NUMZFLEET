import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth, requireManager } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import * as ctrl from './organizationController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

router.get('/', requireAuth, ctrl.getOrganization);
router.patch('/', requireAuth, requireManager, ctrl.patchOrganization);

export default router;
