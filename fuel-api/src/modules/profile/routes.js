import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import { profileUpload } from '../../middleware/profileUpload.js';
import * as ctrl from './profileController.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

// Always operates on the authenticated request's own user (req.user.id /
// req.auth.numzUserId) — never accepts a target id, so there is no "edit someone
// else's profile" surface for requireOwner to guard against here.
router.get('/', requireAuth, ctrl.getMe);
router.patch('/', requireAuth, ctrl.patchMe);
router.patch('/password', requireAuth, ctrl.patchPassword);
router.get('/login-history', requireAuth, ctrl.getLoginHistory);
router.post('/avatar', requireAuth, profileUpload.single('file'), ctrl.postAvatar);
router.get('/avatar/:fileId', requireAuth, ctrl.getAvatar);

export default router;
