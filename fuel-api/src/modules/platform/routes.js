import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth, requirePlatformOwner } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import * as ctrl from './companiesController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);
router.use(requireAuth, requirePlatformOwner);

router.get('/companies', ctrl.listCompanies);
router.post('/companies', ctrl.provisionCompany);

export default router;
