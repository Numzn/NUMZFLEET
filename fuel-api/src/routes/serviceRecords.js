import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAuth, requireManager } from '../middleware/authGates.js';
import { attachTenantContext } from '../middleware/tenantContext.js';
import {
  listRecords,
  createRecord,
  updateRecord,
} from '../controllers/serviceRecordController.js';

const router = express.Router();
router.use(authenticate);
router.use(attachTenantContext);

router.get('/', requireAuth, listRecords);
router.post('/', requireAuth, requireManager, createRecord);
router.patch('/:id', requireAuth, requireManager, updateRecord);

export default router;
