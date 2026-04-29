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
router.get('/erb/latest', requireAuth, getErbLatestPrices);
router.get('/summary', requireAuth, getSummaryReportProxy);
router.get('/trips', requireAuth, getTripsReportProxy);

export default router;
