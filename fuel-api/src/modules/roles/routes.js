import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth, requireManager } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import * as ctrl from './rolesController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

router.get('/', requireAuth, ctrl.listRoles);
router.get('/assignments', requireAuth, ctrl.listAssignments);
router.post('/assignments', requireAuth, requireManager, ctrl.assignRole);
router.delete('/assignments/:userRoleId', requireAuth, requireManager, ctrl.removeRole);

export default router;
