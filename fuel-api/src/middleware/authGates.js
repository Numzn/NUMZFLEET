/**
 * Authorization Gate Middleware
 * Provides reusable guards for different authorization levels
 */

/**
 * Require authenticated user (real or synthetic OK)
 * Use on routes that need basic user context
 */
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to Traccar first',
    });
  }
  next();
};

/**
 * Require real authenticated user (synthetic NOT OK)
 * Use on sensitive routes that need verified Traccar session
 * (e.g., password changes, admin operations)
 */
export const requireRealAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to Traccar first',
    });
  }
  
  if (req.user.synthetic) {
    return res.status(401).json({
      error: 'Real authentication required',
      message: 'This operation requires a real Traccar session',
    });
  }
  
  next();
};

/**
 * Require administrator
 * Use on admin routes
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to Traccar first',
    });
  }
  
  if (!req.user.administrator && !req.user.isManager) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Administrator access required',
    });
  }
  
  next();
};

/**
 * Require user owns resource
 * Use on routes where user accesses their own data
 * 
 * Example:
 *   router.get('/:sessionId', authenticate, requireOwner(req => req.params.sessionId), getSession)
 */
export const requireOwner = (getResourceOwnerId) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to Traccar first',
    });
  }
  
  try {
    const resourceOwnerId = getResourceOwnerId(req);
    const isAdmin = req.user.administrator || req.user.isManager;
    
    if (req.user.id !== resourceOwnerId && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this resource',
      });
    }
    
    next();
  } catch (error) {
    return res.status(400).json({
      error: 'Bad request',
      message: error.message,
    });
  }
};

/**
 * Require authenticated in development mode
 * Allows synthetic users, useful for dev-only routes
 */
export const requireAuthDev = (req, res, next) => {
  if (!req.user && process.env.NODE_ENV !== 'development') {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }
  next();
};

/**
 * Check if user is authenticated (non-blocking, informational)
 * Sets req.isAuthenticated but doesn't block
 */
export const checkAuth = (req, res, next) => {
  req.isAuthenticated = !!req.user && !req.user.synthetic;
  next();
};

  export const requireManager = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!req.user.isManager && !req.user.administrator) {
      return res.status(403).json({ error: 'Forbidden - Manager access required' });
    }
    next();
  };

  export default {
  requireAuth,
  requireRealAuth,
  requireAdmin,
  requireManager,
  requireOwner,
  requireAuthDev,
  checkAuth,
};

