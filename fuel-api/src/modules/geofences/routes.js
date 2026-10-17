import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requireAuth, requireManager } from '../../middleware/authGates.js';
import { attachTenantContext } from '../../middleware/tenantContext.js';
import { searchBoundaries, BoundarySearchError } from './boundarySearchService.js';

const router = express.Router();

router.use(authenticate);
router.use(attachTenantContext);

// Per-user budget on top of the global /api limiter: each miss costs one
// upstream Nominatim call, so keep this tight.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u${req.user?.id ?? req.ip}`,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Too many boundary searches, slow down.' },
});

// Search only: returns candidate boundaries, persists nothing. Geofences are
// still created through Traccar by the client (see TENANCY_ARCHITECTURE §9).
router.get('/search', requireAuth, requireManager, searchLimiter, async (req, res) => {
  try {
    const out = await searchBoundaries(req.query.q);
    res.json(out);
  } catch (e) {
    if (e instanceof BoundarySearchError) {
      return res.status(e.status).json({ error: e.message, code: e.code });
    }
    console.error('[geofenceBoundarySearch]', e);
    return res.status(500).json({ error: 'Boundary search failed.' });
  }
});

export default router;
