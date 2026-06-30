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
  getVehicleAssignments,
  assignDevice,
  updateVehicleConfig,
  updateVehicle,
  deleteVehicle,
  listVehicleServiceRecords,
  createVehicleServiceRecord,
  updateVehicleServiceRecord,
  getVehicleFuelStatistics,
} from '../controllers/vehicleFleetController.js';
import {
  getCapabilities,
  getActive,
  listHistory,
  create as createImmobilizationIntent,
  cancel as cancelImmobilizationIntent,
} from '../controllers/immobilizationIntentController.js';
import {
  getOverviewMetrics,
  getFleetFuelAverage,
  patchVehicleWorkspaceFields,
  postVehiclePhoto,
  getVehicleAttachment,
  listVehicleDocuments,
  postVehicleDocument,
  deleteVehicleDocumentHandler,
} from '../controllers/vehicleWorkspaceController.js';
import { getEngine } from '../vehicleEngine/vehicleEngineController.js';
import { vehicleUpload } from '../middleware/vehicleUpload.js';
import * as authMiddleware from '../middleware/auth.js';
import { requireAuth, requireManager as _requireManager, requireRealAuth } from '../middleware/authGates.js';
import { attachTenantContext } from '../middleware/tenantContext.js';

const router = express.Router();
const { authenticate } = authMiddleware;
const requireManager = authMiddleware.requireManager || _requireManager;

router.use(authenticate);
router.use(attachTenantContext);

router.get('/attachments/:fileId', requireAuth, requireManager, getVehicleAttachment);
router.get('/fuel-efficiency/fleet-average', requireAuth, requireManager, getFleetFuelAverage);

// Mutations and fleet reads: managers only (v1)
router.post('/', requireAuth, requireManager, createVehicle);
router.get('/', requireAuth, requireManager, listVehicles);
// assign-device before :id so "assign-device" is never captured as id
router.post('/:vehicleId/assign-device', requireAuth, requireManager, assignDevice);

// Immobilization intents (vehicle-centric operational control)
router.get('/:vehicleId/immobilization/capabilities', requireAuth, requireManager, getCapabilities);
router.get('/:vehicleId/immobilization-intents/active', requireAuth, requireManager, getActive);
router.get('/:vehicleId/immobilization-intents', requireAuth, requireManager, listHistory);
router.post('/:vehicleId/immobilization-intents', requireAuth, requireManager, requireRealAuth, createImmobilizationIntent);
router.post(
  '/:vehicleId/immobilization-intents/:intentId/cancel',
  requireAuth,
  requireManager,
  cancelImmobilizationIntent,
);

router.get('/:id/assignments', requireAuth, requireManager, getVehicleAssignments);
router.get('/:id/engine', requireAuth, requireManager, getEngine);
router.get('/:id/overview-metrics', requireAuth, requireManager, getOverviewMetrics);
router.get('/:id/fuel-statistics', requireAuth, requireManager, getVehicleFuelStatistics);
router.get('/:id/documents', requireAuth, requireManager, listVehicleDocuments);
router.post('/:id/documents', requireAuth, requireManager, vehicleUpload.single('file'), postVehicleDocument);
router.delete('/:id/documents/:docId', requireAuth, requireManager, deleteVehicleDocumentHandler);
router.post('/:id/photo', requireAuth, requireManager, vehicleUpload.single('file'), postVehiclePhoto);
router.patch('/:id', requireAuth, requireManager, patchVehicleWorkspaceFields);
router.get('/:id/service-records', requireAuth, requireManager, listVehicleServiceRecords);
router.post('/:id/service-records', requireAuth, requireManager, createVehicleServiceRecord);
router.patch('/:id/service-records/:recordId', requireAuth, requireManager, updateVehicleServiceRecord);
router.get('/:id', requireAuth, requireManager, getVehicle);
router.put('/:id/config', requireAuth, requireManager, updateVehicleConfig);
router.put('/:id', requireAuth, requireManager, updateVehicle);
router.delete('/:id', requireAuth, requireManager, deleteVehicle);

export default router;
