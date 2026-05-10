import express from 'express';
import {
  getFuelSummary,
  getTripsReportProxy,
  getSummaryReportProxy,
  getErbLatestPrices,
} from '../controllers/index.js';
import * as authMiddleware from '../../middleware/auth.js';
import { requireAuth } from '../../middleware/authGates.js';

const router = express.Router();
const authenticate = authMiddleware.authenticate;

router.use(authenticate);

router.get('/fuel-summary', requireAuth, getFuelSummary);
// ERB prices are non-sensitive reference data; allow public access so UI doesn't depend on Traccar cookie Path.
router.get('/erb/latest', getErbLatestPrices);
router.get('/summary', requireAuth, getSummaryReportProxy);
router.get('/trips', requireAuth, getTripsReportProxy);

export default router;
