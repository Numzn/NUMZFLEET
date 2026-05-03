# Environment Variables for NUMZFLEET Authentication

This document describes all environment variables used by the unified authentication strategy.

## Quick Start

### Development (No Traccar needed)
```bash
NODE_ENV=development
AUTH_STRATEGY=permissive
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=false
```

Send requests with header: `x-user-id: 5`

### Development (With Docker Compose)
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
```

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
```

---

## All Variables

### Deployment Context

| Variable | Default | Options | Purpose |
|----------|---------|---------|---------|
| `NODE_ENV` | `development` | `development`, `production` | Sets behavior: permissive vs strict |
| `AUTH_STRATEGY` | (depends on NODE_ENV) | `strict`, `permissive`, `hybrid` | Authentication mode |

### Traccar Connection

| Variable | Default | Example | Purpose |
|----------|---------|---------|---------|
| `TRACCAR_ENABLED` | (depends on NODE_ENV) | `true`, `false` | Can we reach Traccar? |
| `TRACCAR_MYSQL_HOST` | `traccar-mysql` | `db.company.com` | MySQL hostname |
| `TRACCAR_MYSQL_PORT` | `3306` | `3306` | MySQL port |
| `TRACCAR_MYSQL_DATABASE` | `traccar` | `traccar` | Database name |
| `TRACCAR_MYSQL_USER` | `traccar` | `fleet_user` | Database user |
| `TRACCAR_MYSQL_PASSWORD` | `traccar123` | (secret) | Database password |
| `TRACCAR_API_URL` | `http://traccar:8082` | `https://traccar.example.com` | Traccar API endpoint (Compose service `traccar`) |

### Development Mode

| Variable | Default | Options | Purpose |
|----------|---------|---------|---------|
| `DEV_AUTH_BYPASS` | `true` (in dev) | `true`, `false` | Allow synthetic users? |
| `LOG_AUTH` | `true` (in dev) | `true`, `false` | Log auth details? |

### Hybrid Mode (Production with Fallback)

| Variable | Default | Options | Purpose |
|----------|---------|---------|---------|
| `HYBRID_FALLBACK` | `false` | `true`, `false` | Allow synthetic users on Traccar outage? |
| `HYBRID_FALLBACK_TTL` | `600` | seconds | How long synthetic sessions last |

---

## Strategy Decision Tree

```
IF NODE_ENV == "production"
  ├─ Default AUTH_STRATEGY = "strict"
  ├─ Default DEV_AUTH_BYPASS = false
  └─ Default TRACCAR_ENABLED = true

ELSE (NODE_ENV == "development")
  ├─ Default AUTH_STRATEGY = "permissive"
  ├─ Default DEV_AUTH_BYPASS = true
  └─ Default TRACCAR_ENABLED = false

Override if environment variables set explicitly
```

---

## Strategy Behavior

### STRICT (Production)
```
Node.js request
    ↓
Has JSESSIONID cookie?
    ├─ YES → Validate with Traccar ──→ Success? YES → Attach user ✅
    │                                ├─ NO → req.user = null
    └─ NO → req.user = null

Handler with requireAuth
    ├─ req.user exists? → YES → Process ✅
    └─ req.user null? → NO → Return 401 ❌
```

**Environment**:
```bash
NODE_ENV=production
AUTH_STRATEGY=strict
TRACCAR_ENABLED=true
DEV_AUTH_BYPASS=false
```

---

### PERMISSIVE (Development)
```
Node.js request
    ↓
Has JSESSIONID?
    ├─ YES → Try Traccar ──→ Success? YES → Attach user ✅
    │                    ├─ NO → Check header
    └─ NO → Check header

Has x-user-id header?
    ├─ YES → Try Traccar lookup ──→ Success? YES → Attach user ✅
    │                          ├─ NO → Create synthetic user ✅
    └─ NO → req.user = null

Handler with requireAuth
    ├─ req.user exists? → YES → Process ✅ (real or synthetic)
    └─ req.user null? → NO → Return 401 ❌
```

**Environment**:
```bash
NODE_ENV=development
AUTH_STRATEGY=permissive
TRACCAR_ENABLED=false  # Traccar not required
DEV_AUTH_BYPASS=true
```

---

### HYBRID (Production with Fallback)
```
Node.js request
    ↓
Has JSESSIONID?
    ├─ YES → Validate with Traccar ──→ Success? YES → Attach user ✅
    │                              ├─ NO → Check header
    └─ NO → Check header

Has x-user-id header AND HYBRID_FALLBACK?
    ├─ YES → Create synthetic user (TTL=HYBRID_FALLBACK_TTL) ⚠️
    └─ NO → req.user = null

Handler with requireAuth
    ├─ req.user exists? → YES → Process ✅ (real or synthetic, temporary)
    └─ req.user null? → NO → Return 401 ❌
```

**Environment**:
```bash
NODE_ENV=production
AUTH_STRATEGY=hybrid
TRACCAR_ENABLED=true
HYBRID_FALLBACK=true
HYBRID_FALLBACK_TTL=600  # 10 minutes
```

---

## Examples

### Example 1: Local Dev Without Docker
```bash
# .env
NODE_ENV=development
AUTH_STRATEGY=permissive
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=false

# Request
curl -H "x-user-id: 5" http://localhost:3000/api/operation-sessions
# Returns: 200 (synthetic user created)
```

### Example 2: Docker Compose Dev
```bash
# docker-compose.yml env for fuel-api
NODE_ENV=development
AUTH_STRATEGY=hybrid
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=true
TRACCAR_MYSQL_HOST=traccar-mysql
TRACCAR_MYSQL_PORT=3306
TRACCAR_MYSQL_DATABASE=traccar
TRACCAR_MYSQL_USER=traccar
TRACCAR_MYSQL_PASSWORD=traccar123

# Request with Traccar session
curl -H "Cookie: JSESSIONID=abc123" http://localhost:3000/api/operation-sessions
# Returns: 200 (real user from Traccar)

# Request with header fallback
curl -H "x-user-id: 5" http://localhost:3000/api/operation-sessions
# Returns: 200 (synthetic user if Traccar lookup fails)
```

### Example 3: Production
```bash
# docker-compose.yml env for fuel-api
NODE_ENV=production
AUTH_STRATEGY=strict
DEV_AUTH_BYPASS=false
TRACCAR_ENABLED=true
TRACCAR_MYSQL_HOST=prod-db.company.com
TRACCAR_MYSQL_PORT=3306
TRACCAR_MYSQL_DATABASE=traccar
TRACCAR_MYSQL_USER=traccar
TRACCAR_MYSQL_PASSWORD=${TRACCAR_DB_PASSWORD}
TRACCAR_API_URL=https://traccar.company.com

# Request with valid session
curl -H "Cookie: JSESSIONID=xyz789" https://api.company.com/api/operation-sessions
# Returns: 200 (validated against Traccar)

# Request without session
curl https://api.company.com/api/operation-sessions
# Returns: 401 Unauthorized

# Request with header (ignored in strict mode)
curl -H "x-user-id: 5" https://api.company.com/api/operation-sessions
# Returns: 401 Unauthorized (header fallback disabled)
```

### Example 4: Production with Graceful Degradation
```bash
# docker-compose.yml env for fuel-api
NODE_ENV=production
AUTH_STRATEGY=hybrid
DEV_AUTH_BYPASS=false
TRACCAR_ENABLED=true
HYBRID_FALLBACK=true
HYBRID_FALLBACK_TTL=600
TRACCAR_MYSQL_HOST=prod-db.company.com
# ...

# Normal operation (Traccar working)
curl -H "Cookie: JSESSIONID=xyz789" https://api.company.com/api/operation-sessions
# Returns: 200 (real user from Traccar)

# During Traccar outage (Traccar unreachable)
# With valid header:
curl -H "x-user-id: 5" https://api.company.com/api/operation-sessions
# Returns: 200 (synthetic user, temporary, logged as fallback)

# Without any auth:
curl https://api.company.com/api/operation-sessions
# Returns: 401 Unauthorized (no credentials)
```

---

## Transition Guide

### From Permissive (Dev) to Strict (Prod)

```bash
# Before (local dev)
NODE_ENV=development
AUTH_STRATEGY=permissive
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=false

# Step 1: Test with Docker Compose (add real Traccar)
NODE_ENV=development
AUTH_STRATEGY=hybrid
DEV_AUTH_BYPASS=true
TRACCAR_ENABLED=true
TRACCAR_MYSQL_HOST=traccar-mysql

# Step 2: Tighten strategy (prepare for prod)
NODE_ENV=development
AUTH_STRATEGY=hybrid
DEV_AUTH_BYPASS=false  ← Disable synthetic users
TRACCAR_ENABLED=true

# Step 3: Production (strict)
NODE_ENV=production
AUTH_STRATEGY=strict
DEV_AUTH_BYPASS=false
TRACCAR_ENABLED=true
TRACCAR_MYSQL_HOST=${PROD_DB_HOST}
```

---

## Troubleshooting

### "Authentication required" (401) in Development
**Cause**: Missing `x-user-id` header or `DEV_AUTH_BYPASS=false`

**Fix**:
```bash
# Add header to request
curl -H "x-user-id: 5" http://localhost:3000/api/...

# Or enable bypass
DEV_AUTH_BYPASS=true npm run dev
```

### "Cannot connect to Traccar" Warning
**Cause**: `TRACCAR_ENABLED=true` but Traccar is down

**Fix**:
```bash
# Option 1: Start Traccar
docker compose -f docker-compose.yml up -d traccar-mysql traccar

# Option 2: Disable Traccar (dev only)
TRACCAR_ENABLED=false npm run dev

# Option 3: Use hybrid mode with fallback
AUTH_STRATEGY=hybrid HYBRID_FALLBACK=true npm run dev
```

### "Database password mismatch"
**Cause**: `TRACCAR_MYSQL_PASSWORD` doesn't match actual database password

**Fix**:
1. Check `docker-compose.yml` for actual password
2. Update environment variable to match
3. Restart fuel-api container

### "Production auth too strict, users can't log in"
**Cause**: `AUTH_STRATEGY=strict` blocking all requests

**Fix**:
1. Ensure Traccar JSESSIONID cookies are being set by Traccar
2. Verify cookies are forwarded by Vite proxy (check `vite.config.js`)
3. Check Traccar is reachable and responding
4. Temporary: Switch to `hybrid` mode with `HYBRID_FALLBACK=true`

---

## Security Notes

🔒 **SECURE DEFAULTS**:
- Production (`NODE_ENV=production`) defaults to `strict` strategy
- Synthetic users disabled in production by default
- Traccar connection required in production

⚠️ **DEVELOPMENT ONLY**:
- `DEV_AUTH_BYPASS=true` allows insecure shortcuts
- Synthetic users are temporary, flagged, and logged
- `AUTH_STRATEGY=permissive` is development-only

🚨 **PRODUCTION CHECKLIST**:
- [ ] `NODE_ENV=production`
- [ ] `AUTH_STRATEGY=strict`
- [ ] `DEV_AUTH_BYPASS=false`
- [ ] `TRACCAR_ENABLED=true`
- [ ] `TRACCAR_MYSQL_PASSWORD` set from secure storage (not in code)
- [ ] `TRACCAR_API_URL` points to HTTPS endpoint
- [ ] Traccar database requires strong password
- [ ] Fuel API behind HTTPS reverse proxy

---

## File References

- Strategy logic: `fuel-api/src/config/auth.config.js`
- Middleware: `fuel-api/src/middleware/auth.js`
- Session validation: `fuel-api/src/services/sessionService.js`
- User lookup: `fuel-api/src/services/userService.js`
- Authorization gates: `fuel-api/src/middleware/authGates.js`
- Full documentation: `fuel-api/AUTHENTICATION_STRATEGY.md`
