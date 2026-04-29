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
import { authenticate } from '../../middleware/auth.js';
import { requireAuth, requireManager } from '../../middleware/authGates.js';

const router = express.Router();

// Lightweight route-specific health endpoint used by ops checks.
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'numztrak-fuel-api', scope: 'fuel-requests' });
});

// All routes require authentication
router.use(authenticate);

// List fuel requests (filtered by role automatically)
router.get('/', requireAuth, listFuelRequests);

// Get single fuel request
router.get('/:id', requireAuth, getFuelRequest);

// Get validation details for fuel request
router.get('/:id/validation', requireAuth, getValidationDetails);

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

