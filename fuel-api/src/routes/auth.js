import express from 'express';
import { loginWithTraccarBridge } from '../auth/loginController.js';

const router = express.Router();

router.post('/login', loginWithTraccarBridge);

export default router;
