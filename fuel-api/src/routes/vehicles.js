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
  updateVehicleConfig,
  updateVehicle,
  deleteVehicle,
} from '../controllers/vehicleFleetController.js';
import * as authMiddleware from '../middleware/auth.js';
import { requireAuth, requireManager as _requireManager } from '../middleware/authGates.js';

const router = express.Router();
const { authenticate } = authMiddleware;
const requireManager = authMiddleware.requireManager || _requireManager;

router.use(authenticate);

// Mutations and fleet reads: managers only (v1)
router.post('/', requireAuth, requireManager, createVehicle);
router.get('/', requireAuth, requireManager, listVehicles);
// assign-device before :id so "assign-device" is never captured as id
router.post('/:vehicleId/assign-device', requireAuth, requireManager, assignDevice);
router.get('/:id', requireAuth, requireManager, getVehicle);
router.put('/:id/config', requireAuth, requireManager, updateVehicleConfig);
router.put('/:id', requireAuth, requireManager, updateVehicle);
router.delete('/:id', requireAuth, requireManager, deleteVehicle);

export default router;
