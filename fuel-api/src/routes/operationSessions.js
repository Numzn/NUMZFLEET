import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAuth } from '../middleware/authGates.js';
import {
  addRefuels,
  closeSession,
  createSession,
  getSessionDetails,
  listSessions,
} from '../controllers/operationSessionController.js';

const router = express.Router();
router.use(authenticate);

router.get('/', requireAuth, listSessions);
router.post('/', requireAuth, createSession);
router.get('/:id', requireAuth, getSessionDetails);
router.post('/:id/close', requireAuth, closeSession);
router.post('/:id/refuels', requireAuth, addRefuels);

export default router;
