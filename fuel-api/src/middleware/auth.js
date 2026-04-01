import { getTraccarUser, getTraccarUserBySessionToken, getTraccarUserBySessionViaAPI, getTraccarUserByEmail } from '../config/traccar.js';

/**
 * Authentication middleware
 * Validates Traccar session and attaches user info to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extract session token from cookies (Traccar stores it as 'JSESSIONID')
    const sessionToken = req.cookies?.JSESSIONID;
    
    // For development: also check headers
    const userIdFromHeader = req.headers['x-user-id'] || req.query.userId;
    
    let user = null;

    // Try to get user from session token first
    if (sessionToken) {
      try {
        // Method 1: Try database lookup
        user = await getTraccarUserBySessionToken(sessionToken);
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ User authenticated via session token (database)');
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Session database lookup failed, trying API validation...', error.message);
        }
        
        // Method 2: Try API-based validation (more reliable)
        try {
          user = await getTraccarUserBySessionViaAPI(sessionToken);
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ User authenticated via session token (API)');
          }
        } catch (apiError) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Session API validation also failed:', apiError.message);
          }
        }
      }
    }

    // Fallback for development: use user ID from header
    if (!user && userIdFromHeader) {
      try {
        user = await getTraccarUser(parseInt(userIdFromHeader));
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ User authenticated via x-user-id header');
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.log('User ID header lookup failed:', error.message);
        }
      }
    }

    // If still no user, check if there's a test/demo mode
    // For now, allow requests without auth (will show empty fuel requests)
    if (!user) {
      // Return empty data instead of 401 to allow dashboard to load
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ No authenticated user found:', {
          hasSessionToken: !!sessionToken,
          hasUserIdHeader: !!userIdFromHeader,
          cookies: Object.keys(req.cookies || {}),
          headers: Object.keys(req.headers).filter(h => h.toLowerCase().includes('cookie') || h.toLowerCase().includes('user'))
        });
      }
      req.user = null;
      return next();
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      administrator: user.administrator || false,
      isManager: user.administrator || false,
      isDriver: !user.administrator
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    // Allow request to proceed but with no user
    req.user = null;
    next();
  }
};

/**
 * Authorization middleware requiring authenticated user
 */
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

/**
 * Authorization middleware for managers only
 */
export const requireManager = (req, res, next) => {
  if (!req.user || !req.user.isManager) {
    return res.status(403).json({ error: 'Forbidden - Manager access required' });
  }
  next();
};

/**
 * Authorization middleware for drivers only
 */
export const requireDriver = (req, res, next) => {
  if (!req.user || !req.user.isDriver) {
    return res.status(403).json({ error: 'Forbidden - Driver access required' });
  }
  next();
};
