# Local Development Guide (standardized)

This repo uses the **root Docker Compose** as the single contract:

- **Full stack rebuild (canonical, Windows):** `.\rebuild-stack.ps1` from repo root (see script for flags).
- Core stack: `docker compose -f docker-compose.yml up -d --build`
- Core + ERB: `docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build`
- Vite dev server: `npm run dev` in `traccar-fleet-system/frontend` (default `http://localhost:5174`)

## 🚀 Quick Start

### Option 1: Docker-only (production-like)

```powershell
cd C:\Users\NUMERI\NUMZFLEET
docker compose -f docker-compose.yml up -d --build
```

### Option 1b: Docker + ERB (auto-generate token if missing)

```powershell
cd C:\Users\NUMERI\NUMZFLEET
.\ensure-erb-token.ps1
docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build
```

### Option 1c: Full rebuild script (build + up + smoke checks)

```powershell
cd C:\Users\NUMERI\NUMZFLEET
.\rebuild-stack.ps1
```

### Option 2: Vite dev + Docker APIs

```powershell
cd C:\Users\NUMERI\NUMZFLEET
docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build

cd traccar-fleet-system\frontend
npm run dev
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

Start the APIs in Docker, then run Vite locally:

```powershell
cd C:\Users\NUMERI\NUMZFLEET
docker compose -f docker-compose.yml -f docker-compose.erb.yml up -d --build

cd traccar-fleet-system\frontend
npm run dev
```

**Benefits:**

- ✅ Instant hot module replacement (HMR)
- ✅ No Docker rebuild needed
- ✅ Fast feedback loop
- ✅ See logs in terminal

### URLs

- Docker static UI: `http://localhost:3002`
- Vite dev UI: `http://localhost:5174`
- Fuel API: `http://localhost:3000`
- Traccar: `http://localhost:8082`

## 📍 URLs

**Backend Services (Docker):**

- Traccar Server: `http://localhost:8082`
- Fuel API: `http://localhost:3000`

**Frontend:**

- Local Dev (Vite): `http://localhost:5174` (HMR enabled; default avoids clashing with Docker on **3002**)
- Docker Compose static UI: `http://localhost:3002`

## 🛠️ How It Works

The `vite.config.js` automatically detects the mode:

- **Docker Mode** (default): Uses service names (`traccar:8082`, `backend:3000`) inside the compose network.
- **Local Dev Mode** (`LOCAL_DEV=true`): Uses `localhost:8082` and `localhost:3000`.

## 🐛 Troubleshooting

### Port 5174 already in use (Vite dev)

Set `VITE_DEV_SERVER_PORT` in `traccar-fleet-system/frontend/.env` to another free port, or stop the process using that port.

### Port 3002 already in use (Docker static frontend)

```powershell
# Stop root Compose frontend (example project name)
docker stop numzfleet-frontend-1
```

### Backend not accessible

```powershell
# Verify backend services are running
docker compose ps
# Check ports
netstat -ano | findstr "3000 8082"
```

### Changes not reflecting

- Make sure you're using `npm run dev`
- Check browser console for errors
- Try hard refresh (Ctrl+Shift+R)

## 💡 Tips

1. **Keep backend in Docker** - It's easier to manage
2. **Use local frontend for development** - Much faster!
3. **Test in Docker before deploying** - Ensures compatibility
4. **Use two terminals** - One for backend, one for frontend

## Canonical Compose Files

- Core: `docker-compose.yml`
- Optional ERB overlay: `docker-compose.erb.yml`

The above is for **local development** (build on your machine).

## Production (registry-only)

Production uses **prebuilt Docker Hub images** and **no** `docker compose build` on the server. See [deployment/REGISTRY_DEPLOY.md](deployment/REGISTRY_DEPLOY.md).

Production backup/restore scripts and checklist: [deployment/backup/README.md](deployment/backup/README.md).
