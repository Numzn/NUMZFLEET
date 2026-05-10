# NUMZFLEET Unified Authentication Strategy

## Overview

This document defines the authentication architecture for NUMZFLEET that works seamlessly in both **development** and **production** environments.

### Design Principles

1. **Environment Awareness**: Behavior adapts based on deployment context
2. **Defense in Depth**: Multiple validation layers with graceful fallbacks
3. **Secure by Default**: Production mode enforces strict validation
4. **Developer Friendly**: Development mode allows safe shortcuts
5. **Separation of Concerns**: Clear layers for extraction, validation, and authorization

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXPRESS REQUEST                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: SESSION EXTRACTION                                     │
│  ─ Extract JSESSIONID from cookies                              │
│  ─ Extract x-user-id from headers                               │
│  ─ Extract userId from query params (dev only)                  │
│  Result: { sessionToken?, userIdHeader?, userId? }              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: SESSION VALIDATION                                     │
│  ─ Validate JSESSIONID with Traccar (MySQL or API)             │
│  ─ On failure: check fallback strategy (DEV vs PROD)           │
│  ─ Return user object or null                                   │
│  Result: { user } or { null }                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: USER ATTACHMENT                                        │
│  ─ Attach user to req.user                                      │
│  ─ Set req.authenticated = true/false                           │
│  ─ Middleware continues (does NOT block)                        │
│  Result: req.user = { id, email, name, ... } or null           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4: AUTHORIZATION GATES                                    │
│  ─ requireAuth: block if !req.user (401)                        │
│  ─ requireAdmin: block if !isAdmin (403)                        │
│  ─ requireOwner: block if doesn't own resource (403)            │
│  Result: Request proceeds or blocked                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ROUTE HANDLER                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Modes

### Mode 1: Strict (Production) 🔒

**When**: `NODE_ENV === 'production'` or `AUTH_STRATEGY === 'strict'`

**Behavior**:
- Requires valid JSESSIONID from Traccar
- NO synthetic users allowed
- Traccar validation **must succeed**
- Returns 401 if any validation fails
- Header fallback disabled

**Validation Flow**:
```
JSESSIONID present?
  ├─ YES → Validate with Traccar
  │        ├─ Valid   → Attach user ✅
  │        └─ Invalid → req.user = null, continue
  └─ NO → req.user = null, continue

Handler checks req.user
  ├─ User exists → Process request ✅
  └─ User null  → Return 401 ❌
```

**Environment Vars**:
```bash
NODE_ENV=production
AUTH_STRATEGY=strict
TRACCAR_ENABLED=true
DEV_AUTH_BYPASS=false
```

---

### Mode 2: Permissive (Development) 🧪

**When**: `NODE_ENV === 'development'` and `DEV_AUTH_BYPASS === 'true'`

**Behavior**:
- Tries JSESSIONID first (best case)
- Falls back to x-user-id header
- If header lookup fails, creates **synthetic user** with same ID
- Synthetic users are safe (not linked to real data)
- Perfect for testing without Traccar running

**Validation Flow**:
```
JSESSIONID present?
  ├─ YES → Try Traccar validation
  │        ├─ Valid   → Attach real user ✅
  │        └─ Invalid → Check header
  └─ NO → Check header

x-user-id header present?
  ├─ YES → Try Traccar lookup
  │        ├─ Valid   → Attach real user ✅
  │        └─ Invalid → Create synthetic user ✅
  └─ NO → req.user = null

Handler checks req.user
  ├─ User exists → Process request ✅
  └─ User null  → Return 401 ❌ (very rare in dev)
```

**Environment Vars**:
```bash
NODE_ENV=development
AUTH_STRATEGY=permissive
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=false  # Optional: Traccar may not be running
```

---

### Mode 3: Hybrid (Production with Graceful Degradation) ⚖️

**When**: `AUTH_STRATEGY === 'hybrid'`

**Behavior**:
- Primary: Strict Traccar validation for JSESSIONID
- Secondary: If JSESSIONID invalid BUT x-user-id header present, try header
- Tertiary: If both fail but flag `HYBRID_FALLBACK=true`, create synthetic user (temporary)
- Logs fallback usage for monitoring
- Used for production deployments where Traccar may have brief outages

**Validation Flow**:
```
JSESSIONID present?
  ├─ YES → Validate with Traccar
  │        ├─ Valid   → Attach user ✅
  │        └─ Invalid → Check header
  └─ NO → Check header

x-user-id header present AND HYBRID_FALLBACK=true?
  ├─ YES → Create synthetic user (log warning) ⚠️
  └─ NO → req.user = null

Handler checks req.user
  ├─ User exists (real or synthetic) → Process request ✅
  └─ User null → Return 401 ❌
```

**Environment Vars**:
```bash
NODE_ENV=production
AUTH_STRATEGY=hybrid
TRACCAR_ENABLED=true
HYBRID_FALLBACK=true   # Allow temporary synthetic users
HYBRID_FALLBACK_TTL=600  # 10 minutes before requiring real session
```

---

## Environment Variables

| Variable | Dev Default | Prod Default | Purpose |
|----------|-------------|--------------|---------|
| `NODE_ENV` | `development` | `production` | Deployment context |
| `AUTH_STRATEGY` | `permissive` | `strict` | strict, permissive, or hybrid |
| `DEV_AUTH_BYPASS` | `true` | `false` | Allow synthetic users in dev |
| `TRACCAR_ENABLED` | `false` | `true` | Can we reach Traccar? |
| `TRACCAR_MYSQL_HOST` | `localhost:3306` | (env var) | Where is Traccar MySQL? |
| `TRACCAR_API_URL` | `http://localhost:8082` | (env var) | Where is Traccar API? |
| `HYBRID_FALLBACK` | N/A | `false` | Allow synthetic fallback in prod |
| `HYBRID_FALLBACK_TTL` | N/A | `600` | Seconds before fallback expires |

---

## Session Validation Methods

### Method 1: Traccar MySQL (Primary - fastest)

Validates JSESSIONID by querying `tc_user_sessions` table.

**Pros**: Fast, works when Traccar API is down
**Cons**: Requires direct DB access, may have schema variations

```javascript
// Check tc_user_sessions table
SELECT userid FROM tc_user_sessions WHERE id = ? AND expiration > NOW()
```

### Method 2: Traccar API (Secondary - authoritative)

Validates JSESSIONID by calling `/api/session` endpoint with cookie.

**Pros**: Most reliable, uses Traccar's native validation
**Cons**: Slower, fails if Traccar API is down

```javascript
// Call Traccar session endpoint
GET http://traccar:8082/api/session
  Cookie: JSESSIONID=abc123
  
Response: { id, name, email, administrator, ... }
```

### Method 3: Header Fallback (Development only)

Validates user by x-user-id header against Traccar MySQL.

**Pros**: Works offline, flexible
**Cons**: Requires valid Traccar user to exist, less secure

```javascript
// Lookup user by ID
SELECT id, email, name, administrator FROM tc_users WHERE id = ? AND disabled = 0
```

### Method 4: Synthetic User (Development only)

Creates temporary user object without validation.

**Pros**: Allows full dev flow without Traccar running
**Cons**: Not real auth, dev-only feature

```javascript
// Create from x-user-id header
{
  id: parseInt(header),
  email: `user${header}@fleet.local`,
  name: `Dev User ${header}`,
  administrator: false,
  isDriver: true,
  synthetic: true  // Flag for logging
}
```

---

## Request Flow Examples

### Example 1: Production - Valid JSESSIONID

```
REQUEST: GET /api/operation-sessions
  Cookie: JSESSIONID=abc123xyz...

LAYER 1 - Extract:
  sessionToken = "abc123xyz..."

LAYER 2 - Validate:
  Call Traccar MySQL: SELECT userid FROM tc_user_sessions WHERE id = ?
  ✅ Found userid = 5

LAYER 3 - Attach:
  req.user = { id: 5, email: "driver@company.com", ... }
  req.authenticated = true

LAYER 4 - Gate:
  Handler requires auth: YES, user exists → OK ✅

RESPONSE: 200 OK [data]
```

### Example 2: Production - Invalid JSESSIONID

```
REQUEST: GET /api/operation-sessions
  Cookie: JSESSIONID=invalid...

LAYER 1 - Extract:
  sessionToken = "invalid..."

LAYER 2 - Validate:
  Call Traccar MySQL: SELECT userid FROM tc_user_sessions WHERE id = ?
  ❌ Not found, error

LAYER 3 - Attach:
  req.user = null
  req.authenticated = false

LAYER 4 - Gate:
  Handler requires auth: YES, user NULL → BLOCK ❌

RESPONSE: 401 Unauthorized
```

### Example 3: Development - No JSESSIONID, x-user-id Header

```
REQUEST: GET /api/operation-sessions
  Headers: x-user-id: 5

LAYER 1 - Extract:
  sessionToken = undefined
  userIdHeader = "5"

LAYER 2 - Validate:
  Try JSESSIONID: None
  Try x-user-id header: 
    Call Traccar MySQL: SELECT ... FROM tc_users WHERE id = 5
    ❌ Connection refused or user not found
    CREATE SYNTHETIC USER:
    { id: 5, email: "user5@fleet.local", synthetic: true, ... }

LAYER 3 - Attach:
  req.user = { id: 5, email: "user5@fleet.local", synthetic: true, ... }
  req.authenticated = false (synthetic, not real)

LAYER 4 - Gate:
  Handler requires auth: YES, user exists → OK ✅

RESPONSE: 200 OK [data]
  (Note: Service layer sees synthetic user and adjusts behavior if needed)
```

### Example 4: Development - Fallback Disabled

```
REQUEST: GET /api/operation-sessions
  (No cookies, no headers)

LAYER 1 - Extract:
  sessionToken = undefined
  userIdHeader = undefined

LAYER 2 - Validate:
  No auth data found
  req.user = null

LAYER 3 - Attach:
  req.authenticated = false

LAYER 4 - Gate:
  Handler requires auth: YES, user NULL → BLOCK ❌

RESPONSE: 401 Unauthorized
  (Even in dev mode, handlers are protected)
```

---

## Middleware Structure

### Auth Middleware (Extraction + Validation + Attachment)

```javascript
export const authenticate = async (req, res, next) => {
  // 1. EXTRACT
  const extracted = await sessionService.extractCredentials(req);
  
  // 2. VALIDATE
  const user = await sessionService.validateAndLoadUser(
    extracted,
    {
      strategy: config.AUTH_STRATEGY,
      traccarEnabled: config.TRACCAR_ENABLED,
      devAuthBypass: config.DEV_AUTH_BYPASS
    }
  );
  
  // 3. ATTACH
  req.user = user;
  req.authenticated = !!user && !user.synthetic;
  
  // 4. LOG (for security audits)
  if (user) {
    req.log.debug('User authenticated', {
      userId: user.id,
      synthetic: user.synthetic,
      method: extracted.method
    });
  }
  
  next(); // Always continue (gates handle blocking)
};
```

### Authorization Gates

```javascript
// Require authenticated user (real or synthetic OK)
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Require real authenticated user (synthetic NOT OK)
export const requireRealAuth = (req, res, next) => {
  if (!req.user || req.user.synthetic) {
    return res.status(401).json({ error: 'Real authentication required' });
  }
  next();
};

// Require admin
export const requireAdmin = (req, res, next) => {
  if (!req.user?.administrator) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Require user owns resource
export const requireOwner = (resourceOwnerId) => (req, res, next) => {
  if (req.user?.id !== resourceOwnerId && !req.user?.administrator) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};
```

### Route Usage

```javascript
// Most routes: allow synthetic users in dev
router.get('/', authenticate, requireAuth, listSessions);

// Sensitive routes: require real auth in production
router.post('/:id/verify', authenticate, requireRealAuth, verifySession);

// Admin routes: require admin
router.delete('/:id', authenticate, requireAdmin, deleteSession);
```

---

## Configuration Hierarchy

Priority: Command Line > Environment File > Defaults

```bash
# .env (checked first)
NODE_ENV=development
AUTH_STRATEGY=permissive
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=false

# Fallback to NODE_ENV defaults if not specified
# If NODE_ENV=production:
#   - AUTH_STRATEGY defaults to strict
#   - DEV_AUTH_BYPASS defaults to false
#   - TRACCAR_ENABLED defaults to true

# Command line override
DEV_AUTH_BYPASS=false npm run dev
```

---

## Deployment Scenarios

### Scenario 1: Local Development (No Traccar)

```bash
NODE_ENV=development
AUTH_STRATEGY=permissive
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=false
```

**Result**: 
- Send `x-user-id: 5` header
- Synthetic user created
- Full flow works without Traccar running

---

### Scenario 2: Docker Compose Dev (With Traccar)

```bash
NODE_ENV=development
AUTH_STRATEGY=hybrid
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=true
TRACCAR_MYSQL_HOST=traccar-mysql:3306
```

**Result**:
- Tries real Traccar session first
- Falls back to synthetic if needed
- Best of both worlds

---

### Scenario 3: Production (Strict)

```bash
NODE_ENV=production
AUTH_STRATEGY=strict
DEV_AUTH_BYPASS=false
TRACCAR_ENABLED=true
TRACCAR_MYSQL_HOST=${DB_HOST}
TRACCAR_API_URL=${TRACCAR_API}
```

**Result**:
- Only real JSESSIONID cookies accepted
- No synthetic users
- Full Traccar validation required
- Secure by default

---

### Scenario 4: Production with Graceful Degradation

```bash
NODE_ENV=production
AUTH_STRATEGY=hybrid
DEV_AUTH_BYPASS=false
TRACCAR_ENABLED=true
HYBRID_FALLBACK=true
HYBRID_FALLBACK_TTL=600
```

**Result**:
- Primary: Strict validation
- Fallback: Synthetic users if Traccar unavailable (10 min max)
- Logs all fallbacks for monitoring
- Survives brief Traccar outages

---

## Security Considerations

### ✅ What's Secure

1. **Synthetic users are scoped**: Limited to development, flagged, traceable
2. **Defaults are strict**: Production requires real auth by default
3. **No secrets in code**: All credentials from environment
4. **Layered defense**: Multiple validation attempts, clear fallbacks
5. **Audit trail**: Logs track how users authenticated
6. **Separation of concerns**: Validation logic isolated from routes

### ⚠️ What Requires Attention

1. **Synthetic users in production**: Only enable for brief outages (set TTL)
2. **Header validation**: Ensure x-user-id is from trusted source (Vite proxy headers, not user-supplied)
3. **Cookie handling**: Set `secure`, `httpOnly`, `sameSite` flags
4. **Rate limiting**: Protect against brute force (not in auth, in separate middleware)
5. **Token expiration**: Implement JSESSIONID expiration checks
6. **CORS**: Restrict credentials: 'include' to trusted origins

---

## Implementation Checklist

- [ ] Create `src/config/auth.config.js` with strategy definitions
- [ ] Create `src/services/sessionService.js` with extraction + validation
- [ ] Create `src/services/userService.js` with user lookups + synthesis
- [ ] Refactor `src/middleware/auth.js` to use services
- [ ] Create authorization gate middleware
- [ ] Add environment variable defaults to `.env.template`
- [ ] Update all routes to use `authenticate + requireAuth`
- [ ] Add `req.authenticated` flag for templates/logging
- [ ] Update route handlers to check `req.user.synthetic` if needed
- [ ] Add integration tests for each strategy
- [ ] Document in README how to configure per environment
- [ ] Set up monitoring for auth failures

---

## Migration Path (From Current Code)

**Current**:
- Single `authenticate` middleware
- Synthetic fallback buried in auth.js
- No clear strategy selection

**After**:
1. Create config layer (AUTH_STRATEGY)
2. Extract validation to services
3. Refactor middleware to use services
4. Update route declarations
5. Backward compatible (routes still work same way)

**Timeline**:
- Phase 1 (now): Add config + services (non-breaking)
- Phase 2 (next): Refactor middleware to use services
- Phase 3 (later): Migrate routes to explicit gates
