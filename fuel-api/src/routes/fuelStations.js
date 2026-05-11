import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAuth } from '../middleware/authGates.js';
import { listActiveFuelStations } from '../controllers/fuelStationController.js';

const router = express.Router();
router.use(authenticate);

router.get('/', requireAuth, listActiveFuelStations);

export default router;
