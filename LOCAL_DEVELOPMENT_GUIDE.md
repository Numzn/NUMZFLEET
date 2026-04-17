# Local Frontend Development Guide

> **Production UI (`dist/`):** primary path is [`deploy-frontend-docker.sh`](deploy-frontend-docker.sh) — **API health** (`GET` `…/health` on `api.numz.site`, overridable with `API_HEALTH_URL`; skip with `SKIP_API_HEALTH_CHECK=1`), then **Node 20 Docker** build (`npm ci` + `npm run build`), **deploy lock** on the server (`LOCK_REMOTE`, default `/tmp/frontend-deploy.lock`), **backup of current `dist/`** before overwrite (`REMOTE_BACKUP`, default `~/NUMZFLEET/backups/dist`; skip with `SKIP_DIST_BACKUP=1`), upload, `nginx -s reload` on `numztrak-nginx`. **Clean Git tree required** unless `DEPLOY_ALLOW_DIRTY=1`; `DEPLOY_REQUIRE_MAIN=1` restricts to `main`. Writes **`frontend-deploy-version.txt`** (override `REMOTE_VERSION_FILE`) including rollback path. **Push to GitHub yourself**; this script does not commit or push.
>
> **Full stack / SHA-locked deploy** (backend + on-server frontend build when Node is available): [`release-prod.ps1`](release-prod.ps1) and [`.github/workflows/release-gate.yml`](.github/workflows/release-gate.yml). Optional automated UI upload: [`.github/workflows/deploy-frontend.yml`](.github/workflows/deploy-frontend.yml) when GitHub Actions are available. Legacy all-in-one script: [`deploy.sh`](deploy.sh).

## 🚀 Quick Start

### Option 1: Using Helper Scripts (Recommended)

**Start Backend + Frontend Locally:**
```powershell
# Terminal 1: Start backend services only
cd backend
.\scripts\start-backend-only.ps1

# Terminal 2: Start frontend locally with HMR
cd traccar-fleet-system\frontend
.\start-local.ps1
```

### Option 2: Manual Commands

**Start Backend in Docker:**
```powershell
cd backend
docker compose -f docker-compose.dev.yml up -d traccar-mysql fuel-postgres traccar-server fuel-api numztrak-nginx
docker stop numztrak-frontend  # Stop Docker frontend to avoid port conflict
```

**Start Frontend Locally:**
```powershell
cd traccar-fleet-system\frontend
npm run start:local
# OR
$env:LOCAL_DEV = "true"; npm start
```

## 📋 Development Workflows

### 🔥 Fast Development (Local Frontend)

**When to use:** Daily coding, styling, UI changes

1. Start backend in Docker:
   ```powershell
   cd backend
   .\scripts\start-backend-only.ps1
   ```

2. Start frontend locally:
   ```powershell
   cd traccar-fleet-system\frontend
   .\start-local.ps1
   ```

3. Make changes - **see them instantly!** ✨

**Benefits:**
- ✅ Instant hot module replacement (HMR)
- ✅ No Docker rebuild needed
- ✅ Fast feedback loop
- ✅ See logs in terminal

### 🐳 Full Docker Stack

**When to use:** Testing, production-like environment

```powershell
cd backend
docker compose -f docker-compose.dev.yml up -d  # Start everything including frontend
```

**Benefits:**
- ✅ Production-like environment
- ✅ All services in containers
- ✅ Easy to test complete stack

## 🔄 Switching Between Modes

### Switch from Docker to Local Dev

```powershell
# Stop Docker frontend
cd backend
.\scripts\stop-frontend-docker.ps1

# Start local frontend
cd ..\traccar-fleet-system\frontend
.\start-local.ps1
```

### Switch from Local Dev to Docker

1. Stop local dev server (Ctrl+C)
2. Start Docker frontend:
   ```powershell
   cd backend
   .\scripts\start-frontend-docker.ps1
   ```

## 📍 URLs

**Backend Services (Docker):**
- Traccar Server: http://localhost:8082
- Fuel API: http://localhost:3001

**Frontend:**
- Local Dev: http://localhost:3002 (HMR enabled)
- Docker: http://localhost:3002

## 🛠️ How It Works

The `vite.config.js` automatically detects the mode:

- **Docker Mode** (default): Uses service names (`traccar-server:8082`, `fuel-api:3001`)
- **Local Dev Mode** (`LOCAL_DEV=true`): Uses `localhost:8082` and `localhost:3001`

## 📝 Helper Scripts

### Frontend Scripts
- `start-local.ps1` - Start frontend in local dev mode

### Backend Scripts
- `start-backend-only.ps1` - Start only backend services (no frontend)
- `start-frontend-docker.ps1` - Start Docker frontend container
- `stop-frontend-docker.ps1` - Stop Docker frontend container

## 🐛 Troubleshooting

### Port 3002 already in use
```powershell
# Stop Docker frontend
docker stop numztrak-frontend
```

### Backend not accessible
```powershell
# Verify backend services are running
docker compose -f docker-compose.dev.yml ps
# Check ports
netstat -ano | findstr "3001 8082"
```

### Changes not reflecting
- Make sure you're using `npm run start:local` or `start-local.ps1`
- Check browser console for errors
- Try hard refresh (Ctrl+Shift+R)

## 💡 Tips

1. **Keep backend in Docker** - It's easier to manage
2. **Use local frontend for development** - Much faster!
3. **Test in Docker before deploying** - Ensures compatibility
4. **Use two terminals** - One for backend, one for frontend

## Canonical Compose Files

- Development: `backend/docker-compose.dev.yml`
- Production: `backend/docker-compose.prod.yml`

