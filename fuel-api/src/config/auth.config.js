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
    
    // Traccar connection details
    TRACCAR: {
      MYSQL_HOST: process.env.TRACCAR_MYSQL_HOST || 'traccar-mysql',
      MYSQL_PORT: parseInt(process.env.TRACCAR_MYSQL_PORT || '3306'),
      MYSQL_DATABASE: process.env.TRACCAR_MYSQL_DATABASE || 'traccar',
      MYSQL_USER: process.env.TRACCAR_MYSQL_USER || 'traccar',
      MYSQL_PASSWORD: process.env.TRACCAR_MYSQL_PASSWORD || 'traccar123',
      API_URL: process.env.TRACCAR_API_URL || 'http://traccar-server:8082',
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
export const STRATEGIES = {
  strict: {
    name: 'strict',
    description: 'Production: Requires valid JSESSIONID from Traccar. No fallbacks.',
    validateSessionToken: true,
    validateHeaderFallback: false,
    allowSyntheticUser: false,
    requireTraccar: true,
    logLevel: 'error',
  },
  
  permissive: {
    name: 'permissive',
    description: 'Development: Tries session, then header, then synthetic user.',
    validateSessionToken: true,
    validateHeaderFallback: true,
    allowSyntheticUser: true,
    requireTraccar: false,
    logLevel: 'debug',
  },
  
  hybrid: {
    name: 'hybrid',
    description: 'Production-safe: Strict primary, synthetic fallback for brief outages.',
    validateSessionToken: true,
    validateHeaderFallback: true,
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
