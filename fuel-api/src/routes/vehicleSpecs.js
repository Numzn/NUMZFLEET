import express from 'express';
import {
  listVehicleSpecs,
  getVehicleSpec,
  updateVehicleSpecification,
  syncFromTraccarAttributes,
  bulkUpdateSpecs
} from '../controllers/vehicleSpecController.js';
import * as authMiddleware from '../middleware/auth.js';

const router = express.Router();
const authenticate = authMiddleware.authenticate;
const requireAuth = authMiddleware.requireAuth;
const requireManager =
  authMiddleware.requireManager ||
  ((req, res, next) => {
    if (!req.user || (!req.user.isManager && !req.user.administrator)) {
      return res.status(403).json({ error: 'Forbidden - Manager access required' });
    }
    return next();
  });

// All routes require authentication
router.use(authenticate);

// List all vehicle specifications (managers only)
router.get('/', requireManager, listVehicleSpecs);

// Get single vehicle specification
router.get('/:deviceId', getVehicleSpec);

// Update vehicle specification (managers only)
router.put('/:deviceId', requireAuth, requireManager, updateVehicleSpecification);

// Sync from Traccar attributes (managers only)
router.post('/:deviceId/sync', requireAuth, requireManager, syncFromTraccarAttributes);

// Bulk update specifications (managers only)
router.post('/bulk-update', requireAuth, requireManager, bulkUpdateSpecs);

export default router;



