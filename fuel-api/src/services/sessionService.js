import { getTraccarUser, getTraccarUserBySessionToken, getTraccarUserBySessionViaAPI } from './userService.js';
import { authConfig, getStrategy } from '../config/auth.config.js';

/**
 * Session Service
 * Handles extraction, validation, and caching of authentication credentials
 */

// Track synthetic user sessions for TTL (hybrid mode)
const syntheticSessions = new Map();

/**
 * Extract credentials from request
 * Looks for JSESSIONID cookie, x-user-id header, userId query param
 */
export const extractCredentials = async (req) => {
  const sessionToken = req.cookies?.JSESSIONID;
  const userIdFromHeader = req.headers['x-user-id'];
  const userIdFromQuery = req.query.userId; // Dev-only convenience
  
  return {
    sessionToken,
    userIdHeader: userIdFromHeader ? parseInt(userIdFromHeader) : null,
    userIdQuery: userIdFromQuery ? parseInt(userIdFromQuery) : null,
    method: sessionToken ? 'sessionToken' : userIdFromHeader ? 'header' : 'none',
  };
};

/**
 * Validate JSESSIONID against Traccar
 * Tries: MySQL lookup first, then Traccar API
 */
export const validateSessionToken = async (sessionToken) => {
  if (!sessionToken) {
    return null;
  }
  
  try {
    // Method 1: Try database lookup
    try {
      const user = await getTraccarUserBySessionToken(sessionToken);
      if (authConfig.LOG_AUTH) {
        console.log('✅ Session validated (Traccar MySQL)');
      }
      return { ...user, validationMethod: 'mysql' };
    } catch (dbError) {
      if (authConfig.LOG_AUTH) {
        console.log('Session MySQL lookup failed, trying API...', dbError.message);
      }
      
      // Method 2: Try API-based validation (more reliable)
      const user = await getTraccarUserBySessionViaAPI(sessionToken);
      if (authConfig.LOG_AUTH) {
        console.log('✅ Session validated (Traccar API)');
      }
      return { ...user, validationMethod: 'api' };
    }
  } catch (error) {
    if (authConfig.LOG_AUTH) {
      console.log('Session validation failed:', error.message);
    }
    return null;
  }
};

/**
 * Validate user ID from header
 * Looks up user in Traccar MySQL by ID
 */
export const validateHeaderUserId = async (userId) => {
  if (!userId) {
    return null;
  }
  
  try {
    const user = await getTraccarUser(userId);
    if (authConfig.LOG_AUTH) {
      console.log('✅ User header validated (Traccar MySQL)');
    }
    return { ...user, validationMethod: 'header' };
  } catch (error) {
    if (authConfig.LOG_AUTH) {
      console.log('User header validation failed:', error.message);
    }
    return null;
  }
};

/**
 * Create a synthetic user from header ID
 * Used in development mode when Traccar is unavailable
 * Marked with synthetic flag for logging/filtering
 */
export const createSyntheticUser = (userId) => {
  if (!userId) {
    return null;
  }
  
  return {
    id: userId,
    email: `user${userId}@fleet.local`,
    name: `Dev User ${userId}`,
    administrator: false,
    isManager: false,
    isDriver: true,
    synthetic: true,
    validationMethod: 'synthetic',
    createdAt: new Date(),
  };
};

/**
 * Check if synthetic session has expired (hybrid mode)
 */
const isSyntheticSessionExpired = (sessionKey) => {
  const session = syntheticSessions.get(sessionKey);
  if (!session) {
    return true;
  }
  
  const age = Date.now() - session.createdAt.getTime();
  const ttl = authConfig.HYBRID_FALLBACK_TTL * 1000; // Convert to ms
  
  const expired = age > ttl;
  
  if (expired) {
    syntheticSessions.delete(sessionKey);
  }
  
  return expired;
};

/**
 * Store synthetic session for TTL tracking
 */
const storeSyntheticSession = (userId, user) => {
  const sessionKey = `synthetic_${userId}`;
  syntheticSessions.set(sessionKey, {
    user,
    createdAt: new Date(),
  });
};

/**
 * Main validation flow
 * Uses strategy to determine fallback behavior
 */
export const validateAndLoadUser = async (credentials, options = {}) => {
  const {
    strategy = authConfig.AUTH_STRATEGY,
    traccarEnabled = authConfig.TRACCAR_ENABLED,
    devAuthBypass = authConfig.DEV_AUTH_BYPASS,
  } = options;
  
  const strategyDef = getStrategy(strategy);
  
  // Step 1: Try session token (if available)
  if (credentials.sessionToken && strategyDef.validateSessionToken) {
    const user = await validateSessionToken(credentials.sessionToken);
    if (user) {
      return user;
    }
  }
  
  // Step 2: Try header fallback (if strategy allows)
  if (credentials.userIdHeader && strategyDef.validateHeaderFallback) {
    const user = await validateHeaderUserId(credentials.userIdHeader);
    if (user) {
      return user;
    }
    
    // Step 3: Try synthetic user (if strategy allows and in dev/bypass mode)
    if (strategyDef.allowSyntheticUser || (devAuthBypass && !traccarEnabled)) {
      const syntheticUser = createSyntheticUser(credentials.userIdHeader);
      
      // Store for TTL tracking if hybrid mode
      if (strategy === 'hybrid') {
        storeSyntheticSession(credentials.userIdHeader, syntheticUser);
      }
      
      if (authConfig.LOG_AUTH) {
        console.log('⚠️ Created synthetic user (Traccar unavailable)', {
          userId: credentials.userIdHeader,
          strategy,
        });
      }
      
      return syntheticUser;
    }
  }
  
  // No user found
  if (authConfig.LOG_AUTH) {
    console.log('⚠️ No authenticated user found', {
      method: credentials.method,
      strategy,
      traccarEnabled,
      cookies: Object.keys(credentials.cookies || {}),
    });
  }
  
  return null;
};

export default {
  extractCredentials,
  validateSessionToken,
  validateHeaderUserId,
  createSyntheticUser,
  validateAndLoadUser,
};
