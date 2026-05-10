# NUMZFLEET Authentication Implementation Guide

This guide helps developers understand and use the unified authentication strategy.

## Overview

The authentication system has **4 key components**:

```
    ┌─ auth.config.js (Strategy definition & env vars)
    │
Middleware (authenticate)
    │
    ├─ sessionService.js (Extraction + Validation)
    │
    └─ userService.js (Traccar lookups)

Authorization Gates (requireAuth, requireAdmin, etc.)
```

---

## Component Responsibilities

### 1. Auth Config (`src/config/auth.config.js`)

**Purpose**: Centralize all authentication configuration and strategy definitions

**What it does**:
- Reads environment variables
- Applies NODE_ENV defaults (dev=permissive, prod=strict)
- Defines strategy behavior (strict, permissive, hybrid)
- Validates configuration on startup
- Logs configuration for debugging

**Example usage**:
```javascript
import { authConfig, getStrategy } from '../config/auth.config.js';

console.log(authConfig.AUTH_STRATEGY);  // 'permissive'
console.log(authConfig.NODE_ENV);       // 'development'

const strategy = getStrategy('permissive');
console.log(strategy.allowSyntheticUser); // true
```

**Key exports**:
- `authConfig` - Current configuration object
- `getStrategy(name)` - Get strategy definition
- `validateAuthConfig()` - Check for production warnings
- `logAuthConfig()` - Pretty-print config

---

### 2. Authenticate Middleware (`src/middleware/auth.js`)

**Purpose**: Extract credentials, validate, and attach user to request

**What it does**:
1. Extracts credentials from cookies/headers/query
2. Validates credentials using configured strategy
3. Attaches `req.user` and `req.authenticated`
4. Never returns error responses (always calls next())
5. Logs authentication details if enabled

**Route integration**:
```javascript
import { authenticate } from '../middleware/auth.js';

router.use(authenticate); // Protect all routes with middleware

// Now all route handlers have req.user available
router.get('/', (req, res) => {
  console.log(req.user?.id);         // User ID (or null)
  console.log(req.authenticated);    // true if real user
});
```

**Key behavior**:
- **Never blocks requests** - continues to handler even if auth fails
- **Always sets req.user** - either user object or null
- **Always sets req.authenticated** - true only if real (not synthetic) user
- **Logs auth events** - if LOG_AUTH=true

**Error handling**:
```javascript
try {
  // ... validation logic
} catch (error) {
  console.error('Auth error:', error);
  req.user = null;           // Clear user
  req.authenticated = false; // Mark as not authenticated
  next();                    // Always continue!
}
```

---

### 3. Session Service (`src/services/sessionService.js`)

**Purpose**: Handle session extraction and validation logic

**What it does**:
- Extracts credentials from request (JSESSIONID, x-user-id, userId)
- Validates JSESSIONID against Traccar
- Validates x-user-id header against Traccar
- Creates synthetic users when allowed
- Tracks synthetic user TTL (hybrid mode)

**Extraction**:
```javascript
const credentials = await extractCredentials(req);
// Returns: { sessionToken, userIdHeader, userIdQuery, method }

// Example:
// {
//   sessionToken: 'abc123xyz',
//   userIdHeader: 5,
//   userIdQuery: null,
//   method: 'sessionToken'
// }
```

**Validation**:
```javascript
const user = await validateAndLoadUser(credentials, {
  strategy: 'permissive',
  traccarEnabled: false,
  devAuthBypass: true
});

// Returns user object or null
// If synthetic: user.synthetic === true
```

**Key validation flow**:
1. Try JSESSIONID → MySQL lookup → API validation
2. If fails: try x-user-id header → MySQL lookup
3. If fails: try synthetic (if allowed by strategy)
4. If all fail: return null

---

### 4. User Service (`src/services/userService.js`)

**Purpose**: Look up users in Traccar MySQL and provide validation

**What it does**:
- Tests Traccar MySQL connection
- Gets user by ID from Traccar
- Gets user by session token (JSESSIONID)
- Validates sessions via Traccar API
- Normalizes user objects

**Example usage**:
```javascript
import { getTraccarUser, getTraccarUserBySessionToken } from '../services/userService.js';

// Get user by ID
const user = await getTraccarUser(5);
// Returns: { id, name, email, administrator, isManager, isDriver }

// Validate session
const user = await getTraccarUserBySessionToken('abc123');
// Returns: user object or throws error

// Validate via API
const user = await getTraccarUserBySessionViaAPI('abc123');
// Calls Traccar /api/session endpoint
```

**Traccar schema expected**:
```sql
-- tc_users table
SELECT id, name, email, administrator, readonly
FROM tc_users
WHERE id = ? AND disabled = 0

-- tc_user_sessions table (optional)
SELECT userid FROM tc_user_sessions WHERE id = ?
```

---

### 5. Authorization Gates (`src/middleware/authGates.js`)

**Purpose**: Enforce access control rules on protected routes

**Types of gates**:

#### requireAuth
```javascript
router.get('/list', authenticate, requireAuth, handler);

// Blocks if req.user is null
// Allows: real users + synthetic users (both authenticated)
```

#### requireRealAuth
```javascript
router.post('/verify', authenticate, requireRealAuth, handler);

// Blocks if req.user is null
// Blocks if req.user.synthetic === true
// Only allows: real Traccar-validated users
```

#### requireAdmin
```javascript
router.delete('/user', authenticate, requireAdmin, handler);

// Blocks if not administrator
// Checks: req.user.administrator === true
```

#### requireOwner
```javascript
const ownershipCheck = (req) => parseInt(req.params.sessionId);
router.get('/:sessionId', authenticate, requireOwner(ownershipCheck), handler);

// Blocks if user doesn't own resource
// Allows: resource owner + admins
```

#### checkAuth (non-blocking)
```javascript
router.get('/profile', authenticate, checkAuth, handler);

// Sets req.isAuthenticated (doesn't block)
// Useful for routes that show different content based on auth status
```

---

## Usage Patterns

### Pattern 1: Public Endpoint (No Auth)
```javascript
router.get('/public/status', (req, res) => {
  res.json({ status: 'ok' });
});
// No authenticate middleware
```

### Pattern 2: Protected Endpoint (Any User)
```javascript
router.get('/my-sessions', authenticate, requireAuth, async (req, res) => {
  const userId = req.user.id;  // Guaranteed to exist
  const sessions = await SessionService.getByUser(userId);
  res.json(sessions);
});
// Works with: real users + synthetic users (dev)
```

### Pattern 3: Admin-Only Endpoint
```javascript
router.delete('/user/:id', authenticate, requireAdmin, async (req, res) => {
  const adminId = req.user.id;
  const targetId = req.params.id;
  await UserService.delete(targetId, adminId);
  res.json({ deleted: true });
});
// Only works with: admins
```

### Pattern 4: Owner-Only Endpoint
```javascript
router.put('/:sessionId', authenticate, requireOwner((req) => req.params.sessionId), async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;
  await SessionService.update(sessionId, userId, req.body);
  res.json({ updated: true });
});
// Works with: session owner + admins
```

### Pattern 5: Sensitive Operation (Real Auth Only)
```javascript
router.post('/change-password', authenticate, requireRealAuth, async (req, res) => {
  const userId = req.user.id;  // Guaranteed real Traccar user
  await UserService.changePassword(userId, req.body.newPassword);
  res.json({ changed: true });
});
// Blocks synthetic users (dev-only)
```

### Pattern 6: Feature Flag Based on Auth Status
```javascript
router.get('/dashboard', authenticate, checkAuth, (req, res) => {
  const isAuthenticated = req.isAuthenticated;  // true if real user
  const userId = req.user?.id;                  // null if not authenticated
  
  // Render dashboard with different content based on auth
  res.json({
    user: userId,
    authenticated: isAuthenticated,
    features: isAuthenticated ? ['edit', 'delete'] : ['view']
  });
});
// Works with: anyone (auth status optional)
```

---

## Testing

### Unit Test Example: Authentication Middleware

```javascript
import { authenticate } from '../middleware/auth.js';
import * as sessionService from '../services/sessionService.js';
import { authConfig } from '../config/auth.config.js';

describe('authenticate middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      cookies: {},
      headers: {},
      query: {}
    };
    res = {};
    next = jest.fn();
  });
  
  it('should attach user from valid session token', async () => {
    const mockUser = { id: 5, email: 'test@example.com', synthetic: false };
    jest.spyOn(sessionService, 'extractCredentials').mockResolvedValue({
      sessionToken: 'abc123',
      userIdHeader: null,
      userIdQuery: null,
      method: 'sessionToken'
    });
    jest.spyOn(sessionService, 'validateAndLoadUser').mockResolvedValue(mockUser);
    
    await authenticate(req, res, next);
    
    expect(req.user).toEqual(mockUser);
    expect(req.authenticated).toBe(true);
    expect(next).toHaveBeenCalled();
  });
  
  it('should set req.user to null if validation fails', async () => {
    jest.spyOn(sessionService, 'extractCredentials').mockResolvedValue({
      sessionToken: null,
      userIdHeader: null,
      userIdQuery: null,
      method: 'none'
    });
    jest.spyOn(sessionService, 'validateAndLoadUser').mockResolvedValue(null);
    
    await authenticate(req, res, next);
    
    expect(req.user).toBeNull();
    expect(req.authenticated).toBe(false);
    expect(next).toHaveBeenCalled();
  });
  
  it('should create synthetic user in dev mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_STRATEGY = 'permissive';
    
    const mockSynthetic = {
      id: 5,
      email: 'user5@fleet.local',
      synthetic: true
    };
    
    jest.spyOn(sessionService, 'extractCredentials').mockResolvedValue({
      sessionToken: null,
      userIdHeader: 5,
      userIdQuery: null,
      method: 'header'
    });
    jest.spyOn(sessionService, 'validateAndLoadUser').mockResolvedValue(mockSynthetic);
    
    await authenticate(req, res, next);
    
    expect(req.user.synthetic).toBe(true);
    expect(req.authenticated).toBe(false);
    expect(next).toHaveBeenCalled();
  });
});
```

### Integration Test Example: Protected Route

```javascript
import request from 'supertest';
import app from '../server.js';

describe('Protected routes', () => {
  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app)
      .get('/api/operation-sessions')
      .expect(401);
    
    expect(res.body.error).toBe('Authentication required');
  });
  
  it('should return 200 with dev auth enabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = 'true';
    
    const res = await request(app)
      .get('/api/operation-sessions')
      .set('x-user-id', '5')
      .expect(200);
    
    expect(Array.isArray(res.body)).toBe(true);
  });
  
  it('should return 403 for admin route without admin user', async () => {
    const res = await request(app)
      .delete('/api/operation-sessions/123')
      .set('x-user-id', '5')  // Regular user, not admin
      .expect(403);
    
    expect(res.body.error).toBe('Access denied');
  });
});
```

---

## Debugging

### Enable Authentication Logging

```bash
LOG_AUTH=true npm run dev
```

Output example:
```
🔐 Auth Configuration:
  Environment: development
  Strategy: permissive
  Traccar Enabled: false
  Dev Auth Bypass: true

🚀 NumzTrak Fuel API Starting...

✅ User authenticated (from logs)
  userId: 5
  method: 'header'
  synthetic: false

✅ User authenticated via x-user-id header (dev mode fallback - synthetic user)
```

### Check Auth Middleware Logs

When `LOG_AUTH=true`:
```javascript
// Success
console.log('✅ Session validated (Traccar MySQL)');
console.log('✅ User authenticated', { userId, method, synthetic });

// Fallback
console.log('⚠️ Created synthetic user (Traccar unavailable)', { userId, strategy });

// Failure
console.log('⚠️ No authenticated user found', { method, strategy, traccarEnabled });
```

### Manual Testing

```bash
# Test with header (dev mode)
curl -H "x-user-id: 5" http://localhost:3000/api/operation-sessions

# Test with no auth
curl http://localhost:3000/api/operation-sessions

# Test with invalid session
curl -H "Cookie: JSESSIONID=invalid" http://localhost:3000/api/operation-sessions
```

---

## Environment Configuration Reference

### Development (Local, No Traccar)
```bash
NODE_ENV=development
AUTH_STRATEGY=permissive
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=false
LOG_AUTH=true
```

**Result**: Full dev flow with x-user-id header fallback and synthetic users

### Development (Docker Compose)
```bash
NODE_ENV=development
AUTH_STRATEGY=hybrid
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=true
TRACCAR_MYSQL_HOST=traccar-mysql
TRACCAR_MYSQL_PORT=3306
TRACCAR_MYSQL_DATABASE=traccar
TRACCAR_MYSQL_USER=traccar
TRACCAR_MYSQL_PASSWORD=traccar123
LOG_AUTH=true
```

**Result**: Real Traccar sessions preferred, header fallback available

### Production (Strict)
```bash
NODE_ENV=production
AUTH_STRATEGY=strict
DEV_AUTH_BYPASS=false
TRACCAR_ENABLED=true
TRACCAR_MYSQL_HOST=${DB_HOST}
TRACCAR_MYSQL_PORT=${DB_PORT}
TRACCAR_MYSQL_DATABASE=traccar
TRACCAR_MYSQL_USER=${DB_USER}
TRACCAR_MYSQL_PASSWORD=${DB_PASSWORD}
TRACCAR_API_URL=https://traccar.example.com
LOG_AUTH=false
```

**Result**: Only Traccar JSESSIONID cookies accepted, no fallbacks

### Production (Safe Fallback)
```bash
NODE_ENV=production
AUTH_STRATEGY=hybrid
HYBRID_FALLBACK=true
HYBRID_FALLBACK_TTL=600
TRACCAR_ENABLED=true
# ... database config ...
LOG_AUTH=false
```

**Result**: Strict primary, 10-min synthetic fallback if Traccar unavailable

---

## Migration Checklist

If you're migrating from old authentication:

- [ ] Update imports: `import { authenticate } from '../middleware/auth.js'`
- [ ] Update imports: `import { requireAuth, requireAdmin } from '../middleware/authGates.js'`
- [ ] Add `authenticate` to all routers: `router.use(authenticate)`
- [ ] Replace `requireAuth` exports: now in `authGates.js`
- [ ] Update route guards: `router.get('/', requireAuth, handler)`
- [ ] Remove old `auth.js` logic (now in services)
- [ ] Test locally: `DEV_AUTH_BYPASS=true npm run dev`
- [ ] Test with Docker: `docker-compose up`
- [ ] Verify Traccar session validation works
- [ ] Test production environment

---

## Common Issues & Solutions

### "Authentication required" in Dev
**Solution**:
```bash
curl -H "x-user-id: 5" http://localhost:3000/api/...
# OR
export DEV_AUTH_BYPASS=true
```

### "Cannot connect to Traccar"
**Solution**:
```bash
# Option 1: Ensure Traccar is running
docker compose -f docker-compose.yml up -d traccar-mysql traccar

# Option 2: Disable Traccar (dev only)
TRACCAR_ENABLED=false npm run dev

# Option 3: Use hybrid with fallback
AUTH_STRATEGY=hybrid HYBRID_FALLBACK=true npm run dev
```

### "Synthetic user in production"
**This is a bug!** Check:
```bash
# Ensure strict mode
[ "$NODE_ENV" == "production" ] && [ "$AUTH_STRATEGY" == "strict" ]

# Verify DEV_AUTH_BYPASS is false
[ "$DEV_AUTH_BYPASS" == "false" ]

# Check Traccar is reachable
curl http://$TRACCAR_MYSQL_HOST:3306
```

### "Headers not forwarding through proxy"
**Solution in vite.config.js**:
```javascript
'/api/operation-sessions': {
  target: 'http://backend:3000',
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      // Ensure headers are forwarded
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
      }
    });
  }
}
```

---

## Related Documentation

- [AUTHENTICATION_STRATEGY.md](./AUTHENTICATION_STRATEGY.md) - Full architecture
- [AUTH_FLOWS_VISUAL.md](./AUTH_FLOWS_VISUAL.md) - Visual flow diagrams
- [AUTH_ENVIRONMENT_VARIABLES.md](./AUTH_ENVIRONMENT_VARIABLES.md) - Env var reference
