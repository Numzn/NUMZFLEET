/**
 * Fleet vehicles API (v1). All routes require auth + manager.
 *
 * Manual smoke (with session cookie or x-user-id in dev):
 * 1. POST /api/vehicles  body: {"name":"Truck 01","plateNumber":"ABC"}
 * 2. POST /api/vehicles/:vehicleId/assign-device  body: {"deviceId":<traccarId>}
 * 3. GET /api/vehicles  -> merged device, position, vehicleSpec
 */
import express from 'express';
import {
  createVehicle,
  listVehicles,
  getVehicle,
  assignDevice,
} from '../controllers/vehicleFleetController.js';
import * as authMiddleware from '../middleware/auth.js';

const router = express.Router();
const { authenticate, requireAuth, requireManager } = authMiddleware;

router.use(authenticate);

// Mutations and fleet reads: managers only (v1)
router.post('/', requireAuth, requireManager, createVehicle);
router.get('/', requireAuth, requireManager, listVehicles);
// assign-device before :id so "assign-device" is never captured as id
router.post('/:vehicleId/assign-device', requireAuth, requireManager, assignDevice);
router.get('/:id', requireAuth, requireManager, getVehicle);

export default router;
