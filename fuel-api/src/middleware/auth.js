import { extractCredentials, validateAndLoadUser } from '../services/sessionService.js';
import { authConfig, logAuthConfig, validateAuthConfig } from '../config/auth.config.js';

/**
 * Authentication Middleware (Extraction + Validation + Attachment)
 * 
 * This middleware:
 * 1. Extracts credentials from cookies, headers, query params
 * 2. Validates against Traccar using configured strategy
 * 3. Attaches user to req.user (or null if not authenticated)
 * 4. Continues to route handler (authorization gates block if needed)
 * 
 * Uses environment variables to determine behavior:
 * - NODE_ENV: development | production
 * - AUTH_STRATEGY: strict | permissive | hybrid
 * - DEV_AUTH_BYPASS: true | false (allow synthetic users)
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extract credentials
    const credentials = await extractCredentials(req);
    
    // Validate and load user
    const user = await validateAndLoadUser(credentials, {
      strategy: authConfig.AUTH_STRATEGY,
      traccarEnabled: authConfig.TRACCAR_ENABLED,
      devAuthBypass: authConfig.DEV_AUTH_BYPASS,
    });
    
    // Attach to request
    req.user = user || null;
    req.authenticated = !!user && !user.synthetic; // Real auth, not synthetic
    
    // Log auth details if enabled
    if (authConfig.LOG_AUTH && user) {
      console.log('✅ User authenticated', {
        userId: user.id,
        method: credentials.method,
        synthetic: user.synthetic || false,
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ Unexpected authentication error:', error);
    // Allow request to proceed but with no user
    req.user = null;
    req.authenticated = false;
    next();
  }
};

/**
 * Initialize authentication system on startup
 * Call this in server.js before starting routes
 */
export const initializeAuth = async () => {
  console.log('🔐 Initializing authentication system...');
  
  // Log configuration
  logAuthConfig();
  
  // Validate configuration
  const valid = validateAuthConfig();
  
  if (!valid && authConfig.isProduction) {
    console.error('❌ Auth configuration invalid in production!');
    process.exit(1);
  }
  
  // Test Traccar connection if enabled
  if (authConfig.TRACCAR_ENABLED) {
    const { testTraccarConnection } = await import('../services/userService.js');
    const connected = await testTraccarConnection();
    
    if (!connected && authConfig.isProduction) {
      console.error('❌ Cannot connect to Traccar in production!');
      process.exit(1);
    }
  }
  
  console.log('✅ Authentication system ready\n');
};
