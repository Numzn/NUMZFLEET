# NUMZFLEET Authentication Architecture - Visual Flows

This document contains visual diagrams of the authentication system for all modes.

## Quick Architecture Overview

```
Frontend Request
    ↓
    + Cookie: JSESSIONID=abc123
    + Header: x-user-id=5
    ↓
Vite Proxy (vite.config.js)
    ↓
Fuel API Express Server
    ↓
┌─────────────────────────────────────────┐
│    Authentication Middleware (Layer)     │
│  ├─ Session Extraction                   │
│  ├─ Session Validation (strategy-based)  │
│  └─ User Attachment to req.user          │
└─────────────────────────────────────────┘
    ↓
Route Handler (with authorization gates)
    ├─ requireAuth: req.user must exist
    ├─ requireRealAuth: req.user must be real (not synthetic)
    ├─ requireAdmin: req.user.administrator = true
    └─ requireOwner: req.user.id matches resource owner
    ↓
    ✅ Process Request or ❌ Return 401/403
```

---

## Development Mode (Permissive) Flow

### Success Case: Valid JSESSIONID Cookie

```
┌──────────────────┐
│  Frontend        │
│  (x-user-id: 5)  │
└────────┬─────────┘
         │ credentials: include
         ↓
┌──────────────────────┐
│  Vite Proxy         │
│  /api/operation-*   │
│  Forward: Cookie ✓  │
│  Forward: Header ✓  │
└────────┬─────────────┘
         ↓
┌──────────────────────────────────────┐
│  Fuel API - Authenticate Middleware   │
├──────────────────────────────────────┤
│  LAYER 1: EXTRACT                     │
│  ✅ sessionToken = abc123             │
│  ✅ userIdHeader = 5                  │
├──────────────────────────────────────┤
│  LAYER 2: VALIDATE (permissive)       │
│  Try JSESSIONID:                      │
│    → Query tc_user_sessions           │
│    → Found userid = 5                 │
│  ✅ User found in Traccar MySQL       │
├──────────────────────────────────────┤
│  LAYER 3: ATTACH                      │
│  req.user = {                         │
│    id: 5,                             │
│    email: driver@company.com,         │
│    administrator: false,              │
│    synthetic: false                   │
│  }                                    │
│  req.authenticated = true ✅          │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│  Route Handler                        │
│  GET /api/operation-sessions          │
│                                       │
│  requireAuth checks req.user:         │
│  ✅ User exists → OK                  │
│                                       │
│  Handler executes                     │
└────────┬─────────────────────────────┘
         ↓
    ✅ 200 OK - List sessions
```

### Fallback Case: No JSESSIONID, x-user-id Header

```
┌──────────────────┐
│  Frontend        │
│  (x-user-id: 5)  │
│  (No cookies)    │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────────────┐
│  Fuel API - Authenticate Middleware   │
├──────────────────────────────────────┤
│  LAYER 1: EXTRACT                     │
│  ✅ userIdHeader = 5                  │
│  ❌ sessionToken = undefined          │
├──────────────────────────────────────┤
│  LAYER 2: VALIDATE (permissive)       │
│  Try JSESSIONID: None                 │
│  Try x-user-id header:                │
│    → Query tc_users WHERE id = 5      │
│    ❌ Connection timeout (Traccar ↓)  │
│  CREATE SYNTHETIC USER:               │
│    {                                  │
│      id: 5,                           │
│      email: user5@fleet.local,        │
│      administrator: false,            │
│      synthetic: true ⚠️               │
│    }                                  │
├──────────────────────────────────────┤
│  LAYER 3: ATTACH                      │
│  req.user = synthetic_user ✅         │
│  req.authenticated = false ⚠️         │
└────────┬─────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  Route Handler                        │
│  GET /api/operation-sessions          │
│                                       │
│  requireAuth checks req.user:         │
│  ✅ User exists → OK (synthetic OK)   │
│                                       │
│  Handler executes                     │
└────────┬─────────────────────────────┘
         ↓
    ✅ 200 OK - List sessions
    (with synthetic user context)
```

### Fallback Case: No Auth Data

```
┌──────────────────┐
│  Frontend        │
│  (No auth data)  │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────────────┐
│  Fuel API - Authenticate Middleware   │
├──────────────────────────────────────┤
│  LAYER 1: EXTRACT                     │
│  ❌ No credentials found              │
├──────────────────────────────────────┤
│  LAYER 2: VALIDATE                    │
│  ❌ No data to validate               │
│  req.user = null                      │
├──────────────────────────────────────┤
│  LAYER 3: ATTACH                      │
│  req.authenticated = false ❌         │
└────────┬─────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  Route Handler                        │
│  GET /api/operation-sessions          │
│                                       │
│  requireAuth checks req.user:         │
│  ❌ User NULL → BLOCK                 │
└────────┬─────────────────────────────┘
         ↓
    ❌ 401 Unauthorized
```

---

## Production Mode (Strict) Flow

### Success Case: Valid JSESSIONID

```
┌──────────────────────┐
│  Frontend            │
│  (logged into        │
│   Traccar)           │
└────────┬─────────────┘
         │ credentials: include
         │ Cookie: JSESSIONID=xyz789
         ↓
┌──────────────────────────────────────┐
│  Fuel API - Authenticate Middleware   │
├──────────────────────────────────────┤
│  LAYER 1: EXTRACT                     │
│  ✅ sessionToken = xyz789             │
│  ❌ userIdHeader = undefined (ignored)│
├──────────────────────────────────────┤
│  LAYER 2: VALIDATE (strict)           │
│  Try JSESSIONID:                      │
│    → Query tc_user_sessions           │
│    ✅ Found userid = 10               │
│    → Load full user                   │
│  ✅ User validated                    │
├──────────────────────────────────────┤
│  LAYER 3: ATTACH                      │
│  req.user = {                         │
│    id: 10,                            │
│    email: manager@company.com,        │
│    administrator: true,               │
│    synthetic: false ✅                │
│  }                                    │
│  req.authenticated = true ✅          │
└────────┬─────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  Route Handler                        │
│  GET /api/operation-sessions          │
│                                       │
│  requireAuth: ✅ User exists          │
│  Handler executes                     │
└────────┬─────────────────────────────┘
         ↓
    ✅ 200 OK - List sessions
```

### Failure Case: No/Invalid JSESSIONID

```
┌──────────────────────┐
│  Frontend            │
│  (not logged in to   │
│   Traccar)           │
└────────┬─────────────┘
         │ No cookies
         │ No headers
         ↓
┌──────────────────────────────────────┐
│  Fuel API - Authenticate Middleware   │
├──────────────────────────────────────┤
│  LAYER 1: EXTRACT                     │
│  ❌ sessionToken = undefined          │
│  ❌ userIdHeader = undefined          │
├──────────────────────────────────────┤
│  LAYER 2: VALIDATE (strict)           │
│  Required: JSESSIONID                 │
│  ❌ Missing                           │
│  Fallback (x-user-id): DISABLED ❌    │
│  Synthetic users: DISABLED ❌         │
│  req.user = null                      │
├──────────────────────────────────────┤
│  LAYER 3: ATTACH                      │
│  req.authenticated = false ❌         │
└────────┬─────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  Route Handler                        │
│  GET /api/operation-sessions          │
│                                       │
│  requireAuth checks:                  │
│  ❌ req.user is NULL                  │
│  → Return 401                         │
└────────┬─────────────────────────────┘
         ↓
    ❌ 401 Unauthorized
    "Authentication required"
```

---

## Hybrid Mode (Production Fallback) Flow

### Primary: Valid JSESSIONID

```
Same as Strict Success Case ✅
```

### Secondary: Traccar Down, Header Present

```
┌──────────────────────────────────────┐
│  Frontend                             │
│  x-user-id: 5                         │
└────────┬─────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────┐
│  Fuel API - Authenticate Middleware   │
├──────────────────────────────────────┤
│  LAYER 1: EXTRACT                     │
│  ✅ userIdHeader = 5                  │
│  ❌ sessionToken = undefined          │
├──────────────────────────────────────┤
│  LAYER 2: VALIDATE (hybrid)           │
│  Try JSESSIONID:                      │
│    ❌ None                            │
│  Try x-user-id fallback:              │
│    → Query tc_users WHERE id = 5      │
│    ❌ Connection refused (Traccar ↓)  │
│  HYBRID_FALLBACK = true?              │
│    ✅ YES → Create synthetic user     │
│    ⚠️ Temporary (TTL=600s)            │
│    ⚠️ Log warning for monitoring      │
├──────────────────────────────────────┤
│  LAYER 3: ATTACH                      │
│  req.user = {                         │
│    id: 5,                             │
│    email: user5@fleet.local,          │
│    synthetic: true ⚠️                 │
│    temporary: true ⚠️                 │
│  }                                    │
│  req.authenticated = false ⚠️         │
└────────┬─────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│  Route Handler                        │
│  GET /api/operation-sessions          │
│                                       │
│  requireAuth: ✅ User exists          │
│  Handler executes                     │
│  (Service layer sees synthetic flag)  │
└────────┬─────────────────────────────┘
         ↓
    ✅ 200 OK (with warning logs)
    🔔 Alert: Using temporary synthetic
       user - Traccar unreachable
```

---

## Authorization Gate Decision Tree

```
┌─────────────────────────────────────────┐
│  Request with req.user attached         │
└────────────┬────────────────────────────┘
             │
             ↓
    ┌────────────────────┐
    │ Does route use     │
    │ requireAuth?       │
    └────────┬───────────┘
             │
    ┌────────┴─────────────────────────────┐
    │                                       │
  YES                                      NO
    │                                       │
    ↓                                       ↓
┌─────────────────┐                 ┌──────────────┐
│ Is req.user     │                 │ Continue to  │
│ truthy?         │                 │ handler      │
└────────┬────────┘                 └──────────────┘
         │
    ┌────┴──────────────────┐
    │                       │
  YES                      NO
    │                       │
    ↓                       ↓
┌──────────────┐     ┌─────────────┐
│ Check gate   │     │ Return 401  │
│ type:        │     │ Unauthorized│
└────┬─────────┘     └─────────────┘
     │
     ├─ requireAuth?
     │  └─ YES → Continue ✅
     │
     ├─ requireRealAuth?
     │  ├─ NO (synthetic) → Return 401
     │  └─ YES (real) → Continue ✅
     │
     ├─ requireAdmin?
     │  ├─ NO admin flag → Return 403
     │  └─ YES admin → Continue ✅
     │
     └─ requireOwner(id)?
        ├─ Different user → Return 403
        └─ Same user/admin → Continue ✅
```

---

## Error Response Flow

```
All unhandled errors in auth middleware:
    │
    ↓
try/catch block
    ├─ Catch error
    ├─ Log error
    └─ Set req.user = null
    │  req.authenticated = false
    │
    ↓
next() → Middleware continues
    │
    ↓
Route handler
    │
    ↓
Authorization gate (requireAuth, etc.)
    │
    ├─ Has req.user? YES → OK ✅
    └─ Has req.user? NO  → Return error response ❌
```

**Important**: The auth middleware **never** returns an error response itself. It always calls `next()`. This allows:
- Conditional logging on error
- Fallback behavior (synthetic users in dev)
- Graceful degradation
- Clear separation between "extraction failure" (sets req.user=null) and "access denied" (gate returns error)

---

## Request Flow Comparison Table

| Scenario | Permissive (Dev) | Strict (Prod) | Hybrid (Prod-Safe) |
|----------|------------------|---------------|-------------------|
| **JSESSIONID valid** | ✅ User attached | ✅ User attached | ✅ User attached |
| **JSESSIONID invalid** | Try header → synthetic | ❌ 401 | Try header → synthetic (TTL) |
| **x-user-id header** | ✅ Try lookup → synthetic if fails | ❌ Ignored | ✅ Try lookup → synthetic if fails (TTL) |
| **No credentials** | ❌ 401 | ❌ 401 | ❌ 401 |
| **Traccar down** | ✅ Falls back to header | ⚠️ All fail (401) | ✅ Falls back (synthetic + TTL) |
| **Normal load** | ✅ Fastest (minimal checks) | ✅ Most secure | ✅ Balanced |

---

## File Structure

```
fuel-api/src/
├── middleware/
│   ├── auth.js                    ← Main middleware
│   └── authGates.js               ← Authorization gates
├── services/
│   ├── sessionService.js          ← Extraction & validation logic
│   └── userService.js             ← Traccar lookups & synthesis
└── config/
    └── auth.config.js             ← Strategy definitions & config
```

---

## Integration Points

### Vite Proxy (Frontend)
```javascript
// vite.config.js
'/api/operation-sessions': {
  target: 'http://backend:3000',
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      // Forward credentials ✅
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

### Express Routes (Backend)
```javascript
// routes/operationSessions.js
import { authenticate } from '../middleware/auth.js';
import { requireAuth, requireAdmin } from '../middleware/authGates.js';

const router = express.Router();

// All routes: attach user to request
router.use(authenticate);

// Protected routes: require authenticated user
router.get('/', requireAuth, listSessions);      // Need user
router.post('/:id/verify', requireRealAuth, verifySession);  // Need REAL user
router.delete('/:id', requireAdmin, deleteSession);          // Need admin
```

### Controllers (Business Logic)
```javascript
// controllers/operationSessionController.js
export const listSessions = async (req, res) => {
  // req.user is already attached by middleware
  const userId = req.user.id;
  const isSynthetic = req.user.synthetic;
  
  if (isSynthetic) {
    // Service layer can log or handle synthetic users differently
  }
  
  const sessions = await operationSessionService.getUserSessions(userId);
  res.json(sessions);
};
```

---

## Summary

```
AUTHENTICATION SYSTEM OVERVIEW

1️⃣ EXTRACTION (sessionService.extractCredentials)
   └─ Get credentials from cookies, headers, query params

2️⃣ VALIDATION (sessionService.validateAndLoadUser)
   └─ Check JSESSIONID → Check header → Create synthetic (if allowed)

3️⃣ ATTACHMENT (authenticate middleware)
   └─ Set req.user and req.authenticated

4️⃣ AUTHORIZATION (authGates middleware)
   └─ Check req.user and return 401/403 if needed

5️⃣ HANDLING (route handler)
   └─ Process authenticated request with user context
```

**Key Design**:
- Extraction & validation are **separate concerns**
- Middleware **never returns errors** (always calls next())
- Routes **declare protection** with explicit gates
- Each layer is **testable independently**
- Environment variables **control all behavior** (no code changes needed per environment)
