import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth, requireManager } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import * as ctrl from './peopleController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

router.get('/', requireAuth, requireManager, ctrl.listPeople);
router.post('/', requireAuth, requireManager, ctrl.createPerson);
router.get('/:traccarUserId', requireAuth, requireManager, ctrl.getPerson);
router.patch('/:traccarUserId', requireAuth, requireManager, ctrl.updatePerson);
router.delete('/:traccarUserId', requireAuth, requireManager, ctrl.deletePerson);

export default router;
