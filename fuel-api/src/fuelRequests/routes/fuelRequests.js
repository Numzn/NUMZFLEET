import express from 'express';
import {
  createFuelRequest,
  listFuelRequests,
  getFuelRequest,
  approveFuelRequest,
  rejectFuelRequest,
  cancelFuelRequest,
  fulfillFuelRequest,
  getValidationDetails
} from '../controllers/index.js';
import * as authMiddleware from '../../middleware/auth.js';

const router = express.Router();
const authenticate = authMiddleware.authenticate;
const requireAuth =
  authMiddleware.requireAuth ||
  ((req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return next();
  });
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

// List fuel requests (filtered by role automatically)
router.get('/', listFuelRequests);

// Get single fuel request
router.get('/:id', getFuelRequest);

// Get validation details for fuel request
router.get('/:id/validation', getValidationDetails);

// Create fuel request (drivers)
router.post('/', requireAuth, createFuelRequest);

// Approve fuel request (managers only)
router.put('/:id/approve', requireAuth, requireManager, approveFuelRequest);

// Reject fuel request (managers only)
router.put('/:id/reject', requireAuth, requireManager, rejectFuelRequest);

// Cancel fuel request (driver - own requests only)
router.delete('/:id', requireAuth, cancelFuelRequest);

// Mark as fulfilled
router.put('/:id/fulfill', requireAuth, fulfillFuelRequest);

export default router;

