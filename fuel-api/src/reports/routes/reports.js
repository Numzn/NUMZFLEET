import express from 'express';
import {
  getFuelSummary,
  getTripsReportProxy,
  getSummaryReportProxy,
  getErbLatestPrices,
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

router.use(authenticate);

router.get('/fuel-summary', requireAuth, getFuelSummary);
router.get('/erb/latest', requireAuth, getErbLatestPrices);
router.get('/summary', requireAuth, getSummaryReportProxy);
router.get('/trips', requireAuth, getTripsReportProxy);

export default router;
