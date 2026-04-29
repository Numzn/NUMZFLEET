import express from 'express';
import {
  listVehicleSpecs,
  getVehicleSpec,
  updateVehicleSpecification,
  syncFromTraccarAttributes,
  bulkUpdateSpecs
} from '../controllers/vehicleSpecController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAuth, requireManager } from '../middleware/authGates.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// List all vehicle specifications (managers only)
router.get('/', requireManager, listVehicleSpecs);

// Get single vehicle specification
router.get('/:deviceId', requireAuth, getVehicleSpec);

// Update vehicle specification (managers only)
router.put('/:deviceId', requireAuth, requireManager, updateVehicleSpecification);

// Sync from Traccar attributes (managers only)
router.post('/:deviceId/sync', requireAuth, requireManager, syncFromTraccarAttributes);

// Bulk update specifications (managers only)
router.post('/bulk-update', requireAuth, requireManager, bulkUpdateSpecs);

export default router;



