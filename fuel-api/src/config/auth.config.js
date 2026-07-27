import dotenv from 'dotenv';

dotenv.config();

/**
 * Authentication Configuration
 * Centralizes all auth-related settings and strategy definitions
 */

const DEV_DEFAULTS = {
  AUTH_STRATEGY: 'permissive',
  DEV_AUTH_BYPASS: true,
  TRACCAR_ENABLED: false,
};

const PROD_DEFAULTS = {
  AUTH_STRATEGY: 'strict',
  DEV_AUTH_BYPASS: false,
  TRACCAR_ENABLED: true,
};

/**
 * Resolve configuration based on NODE_ENV and environment variables
 */
const getConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Start with environment-appropriate defaults
  const defaults = isProduction ? PROD_DEFAULTS : DEV_DEFAULTS;
  
  return {
    // Deployment context
    NODE_ENV: process.env.NODE_ENV || 'development',
    isDevelopment,
    isProduction,
    
    // Auth strategy: 'strict' | 'permissive' | 'hybrid'
    AUTH_STRATEGY: process.env.AUTH_STRATEGY || defaults.AUTH_STRATEGY,
    
    // Development mode flags
    DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS === 'true' || defaults.DEV_AUTH_BYPASS,
    TRACCAR_ENABLED: process.env.TRACCAR_ENABLED === 'true' || defaults.TRACCAR_ENABLED,
    
    // Hybrid mode specific
    HYBRID_FALLBACK: process.env.HYBRID_FALLBACK === 'true' || false,
    HYBRID_FALLBACK_TTL: parseInt(process.env.HYBRID_FALLBACK_TTL || '600'), // seconds
    
    // Traccar connection details (keep MYSQL_* fallbacks in sync with src/config/traccar.js)
    TRACCAR: {
      MYSQL_HOST: process.env.TRACCAR_MYSQL_HOST || 'traccar-mysql',
      MYSQL_PORT: parseInt(process.env.TRACCAR_MYSQL_PORT || '3306'),
      MYSQL_DATABASE:
        process.env.TRACCAR_MYSQL_DATABASE || process.env.MYSQL_DATABASE || 'traccar',
      MYSQL_USER: process.env.TRACCAR_MYSQL_USER || process.env.MYSQL_USER || 'traccar',
      MYSQL_PASSWORD:
        process.env.TRACCAR_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || 'traccar123',
      API_URL: process.env.TRACCAR_API_URL || 'http://traccar:8082',
    },
    
    // Logging
    LOG_AUTH: process.env.LOG_AUTH === 'true' || isDevelopment,
  };
};

export const authConfig = getConfig();

/**
 * Strategy definitions
 * Each strategy defines how authentication and fallback work
 */
// trustHeaderAsRealUser: whether an unsigned x-user-id header may be resolved to a REAL,
// fully-privileged Traccar identity with no password/token/signature check at all.
// allowSyntheticUser: whether an unsigned x-user-id header may instead produce a
// least-privilege placeholder user (never administrator/manager) for brief-outage tolerance.
// These must stay independent: hybrid previously conflated them via a single
// validateHeaderFallback flag, which let anyone impersonate any real user (including
// admins) by sending x-user-id with no session cookie at all. See sessionService.js
// validateAndLoadUser for how these two flags are now consumed separately.
export const STRATEGIES = {
  strict: {
    name: 'strict',
    description: 'Production: Requires valid JSESSIONID from Traccar. No fallbacks.',
    validateSessionToken: true,
    trustHeaderAsRealUser: false,
    allowSyntheticUser: false,
    requireTraccar: true,
    logLevel: 'error',
  },

  permissive: {
    name: 'permissive',
    description: 'Development only: Tries session, then trusts x-user-id as a real user, then synthetic. Never valid in production (see validateAuthConfig).',
    validateSessionToken: true,
    trustHeaderAsRealUser: true,
    allowSyntheticUser: true,
    requireTraccar: false,
    logLevel: 'debug',
  },

  hybrid: {
    name: 'hybrid',
    description: 'Production-safe: Strict primary; on missing/invalid session, x-user-id may only ever produce a least-privilege synthetic user (opt-in via HYBRID_FALLBACK=true) for brief outages — never a real identity.',
    validateSessionToken: true,
    trustHeaderAsRealUser: false,
    allowSyntheticUser: false, // Synthetic only if HYBRID_FALLBACK=true
    requireTraccar: true,
    logLevel: 'warn',
  },
};

/**
 * Get the current strategy configuration
 */
export const getStrategy = (strategyName = authConfig.AUTH_STRATEGY) => {
  const strategy = STRATEGIES[strategyName];
  
  if (!strategy) {
    console.error(`Unknown auth strategy: ${strategyName}`);
    // Fallback to safe default
    return authConfig.isProduction ? STRATEGIES.strict : STRATEGIES.permissive;
  }
  
  // In hybrid mode, allow synthetic users if flag is set
  if (strategyName === 'hybrid' && authConfig.HYBRID_FALLBACK) {
    return {
      ...strategy,
      allowSyntheticUser: true,
    };
  }
  
  return strategy;
};

/**
 * Validate configuration on startup
 */
export const validateAuthConfig = () => {
  const errors = [];
  
  if (authConfig.isProduction) {
    if (authConfig.AUTH_STRATEGY === 'permissive') {
      errors.push('⚠️ WARNING: Running permissive auth in production! Set AUTH_STRATEGY=strict');
    }
    if (!authConfig.TRACCAR_ENABLED) {
      errors.push('⚠️ WARNING: Traccar disabled in production! Set TRACCAR_ENABLED=true');
    }
    const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim());
    if (corsOrigins.includes('*')) {
      errors.push('⚠️ WARNING: CORS_ORIGIN=* in production! Set explicit allowed origins.');
    }
  }
  
  if (errors.length > 0) {
    errors.forEach(e => console.warn(e));
  }
  
  return errors.length === 0;
};

/**
 * Log configuration on startup
 */
export const logAuthConfig = () => {
  if (authConfig.LOG_AUTH) {
    console.log('\n🔐 Auth Configuration:');
    console.log(`  Environment: ${authConfig.NODE_ENV}`);
    console.log(`  Strategy: ${authConfig.AUTH_STRATEGY}`);
    console.log(`  Traccar Enabled: ${authConfig.TRACCAR_ENABLED}`);
    console.log(`  Dev Auth Bypass: ${authConfig.DEV_AUTH_BYPASS}`);
    if (authConfig.AUTH_STRATEGY === 'hybrid') {
      console.log(`  Hybrid Fallback: ${authConfig.HYBRID_FALLBACK}`);
      console.log(`  Hybrid TTL: ${authConfig.HYBRID_FALLBACK_TTL}s`);
    }
    console.log('');
  }
};

export default authConfig;
