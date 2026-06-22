import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAuth, requireManager } from '../middleware/authGates.js';
import { attachTenantContext } from '../middleware/tenantContext.js';
import {
  addRefuels,
  approveSession,
  closeSession,
  createAdjustment,
  createSession,
  getDailyReports,
  getForecast,
  getInvoice,
  getInvoiceAttachment,
  getManagementReports,
  getSessionDetails,
  getVehicleReports,
  getVehicleStatistics,
  putInvoice,
  listInvoices,
  postInvoice,
  postInvoiceUpload,
  patchInvoice,
  patchInvoiceUpload,
  listSessions,
  markArrived,
  skipVehicle,
  unskipVehicle,
  patchSession,
  planSession,
  recordRefuel,
  regenerateForecast,
  unlockSession,
} from '../controllers/operationSessionController.js';
import { invoiceUpload } from '../middleware/invoiceUpload.js';

const router = express.Router();
router.use(authenticate);
router.use(attachTenantContext);

router.get('/reports/daily', requireAuth, getDailyReports);
router.get('/reports/vehicles', requireAuth, getVehicleReports);
router.get('/reports/management', requireAuth, getManagementReports);
router.get('/vehicles/:vehicleId/statistics', requireAuth, getVehicleStatistics);
router.get('/attachments/:fileId', requireAuth, getInvoiceAttachment);

router.get('/', requireAuth, listSessions);
router.post('/', requireAuth, createSession);
router.post('/plan', requireAuth, planSession);

router.get('/:id', requireAuth, getSessionDetails);
router.patch('/:id', requireAuth, patchSession);
router.get('/:id/forecast', requireAuth, getForecast);
router.post('/:id/forecast/regenerate', requireAuth, regenerateForecast);
router.post('/:id/approve', requireAuth, requireManager, approveSession);
router.post('/:id/refuel', requireAuth, recordRefuel);
router.post('/:id/arrive', requireAuth, markArrived);
router.post('/:id/skip', requireAuth, skipVehicle);
router.post('/:id/unskip', requireAuth, unskipVehicle);
router.post('/:id/refuels', requireAuth, addRefuels);
router.post('/:id/adjustments', requireAuth, createAdjustment);
router.get('/:id/invoice', requireAuth, getInvoice);
router.put('/:id/invoice', requireAuth, requireManager, putInvoice);
router.get('/:id/invoices', requireAuth, listInvoices);
router.post('/:id/invoices', requireAuth, requireManager, postInvoice);
router.post('/:id/invoices/upload', requireAuth, requireManager, invoiceUpload.single('file'), postInvoiceUpload);
router.patch('/:id/invoices/:invoiceId', requireAuth, requireManager, patchInvoice);
router.patch('/:id/invoices/:invoiceId/upload', requireAuth, requireManager, invoiceUpload.single('file'), patchInvoiceUpload);
router.post('/:id/unlock', requireAuth, requireManager, unlockSession);
router.post('/:id/close', requireAuth, requireManager, closeSession);

export default router;
