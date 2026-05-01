# NUMZFLEET — deployment flow (authoritative)

This document is the **single runbook** for how production and registry-based deploys work. Older notes may exist; **follow this file** unless it is explicitly updated.

---

## Principles (all flows)

1. **Deploy only commits that are on `origin/main`** (same rule as `release-prod.ps1`). Do not deploy random local SHAs to production.
2. **Merge when CI is green** (`release-gate` on GitHub).
3. **Prefer Git on the server** over copying `dist/` or images from a laptop. Emergency hotfixes are the exception; still prefer commit + scripted deploy.
4. **Image tags and git checkout should use the same commit identifier** when using Track B (see below). Recommended: **full SHA** from `git rev-parse HEAD` so it matches `.\release-prod.ps1 -Commit <sha>`.

---

## Flow A — Full production stack (default today)

**What it is:** SSH to the server, `git checkout` the deploy SHA under `~/NUMZFLEET`, `docker compose` starts databases and services, reloads **numztrak-nginx** with static files from `traccar-fleet-system/frontend/dist`.

**Two ways to refresh the SPA + fuel-api:**

| Mode | Server does | When to use |
|------|----------------|-------------|
| **Classic (slow)** | `docker compose --build` for fuel-api; `npm ci` + `vite build` (or Node container) for frontend | No registry images yet; simplest mental model |
| **Registry fast path** | `docker pull` frontend + backend images, copy SPA out of the frontend image into `dist/`, `docker compose up --no-build` for fuel-api | Images already pushed for that commit (see below) |

**When to use:** Normal production releases, DB/schema changes, nginx or Traccar config changes. Prefer the **registry fast path** for day-to-day app deploys once CI or your laptop has pushed images for the SHA you are releasing.

### Steps (classic)

1. Push your work to **`main`** and wait for **`release-gate`** (and other required checks) to pass.
2. On your Windows machine, from the **repo root**:

   ```powershell
   .\release-prod.ps1
   ```

   Optional: deploy a specific commit (including rollback):

   ```powershell
   .\release-prod.ps1 -Commit <full-or-partial-sha>
   ```

   Optional: skip local lint/build/nginx check (SHA must still be on `origin/main`):

   ```powershell
   .\release-prod.ps1 -SkipLocalChecks
   ```

3. Confirm health output at the end of the script (HTTPS, Traccar API, Fuel API).

### Steps (registry fast path — recommended for speed)

Images must exist as `{RegistryImagePrefix}/numztrak-frontend:{fullSha}` and `{RegistryImagePrefix}/numztrak-backend:{fullSha}` (same tagging as `deploy-registry.ps1`).

1. **Push** images for the commit you will deploy (from repo root):

   ```powershell
   .\deploy-registry.ps1 -Action BuildPush -Commit <optional-sha>
   ```

2. **Release** with registry flags (Docker Hub user or GHCR owner path, **no** trailing slash):

   ```powershell
   .\release-prod.ps1 -UseRegistryAppImages -RegistryImagePrefix "yourdockerhubuser" -SkipLocalChecks
   ```

   With an explicit commit:

   ```powershell
   .\release-prod.ps1 -Commit abc123... -UseRegistryAppImages -RegistryImagePrefix "ghcr.io/yourorg" -SkipLocalChecks
   ```

   The server **does not** run `npm ci` / Vite for the frontend; it **pulls** the frontend image and copies `/usr/share/nginx/html` into `dist/`. Fuel API is **pulled** instead of built when this mode is on.

**Rollback (Flow A):** run `.\release-prod.ps1 -Commit <previous-known-good-sha>` (add the same `-UseRegistryAppImages -RegistryImagePrefix ...` if you rolled forward with that mode).

**Related files:** `release-prod.ps1`, `deploy-registry.ps1`, `backend/docker-compose.prod.yml`, `backend/nginx/nginx.prod.conf`, `backend/.env` on the server.

---

## Flow B — Registry images (versioned app tier)

**What it is:** On a **build machine** (or CI), build Docker images for the **frontend** (nginx + static bundle) and **fuel-api**, tag them with the **git SHA**, **push** to Docker Hub or GHCR. On a **target host**, **pull** those tags and **run** the containers.

**When to use:**

- **B1 — Standalone slab:** Staging host, DR, or a minimal stack using `deployment/compose/docker-compose.prod.yml` only (frontend + fuel API on published ports). Does **not** include Traccar, databases, or edge TLS as in `backend/docker-compose.prod.yml`.
- **B2 — Hybrid production (target):** Same server as Flow A, but you eventually replace “build frontend on server + bind-mount `dist/`” and optionally “compose build fuel-api” with **pulled images** wired into the **existing** `numztrak-network` and nginx upstreams. **This wiring is not committed as the default yet**; use the checklist in “Hybrid integration checklist” when you are ready.

### Prerequisites (Track B)

- Docker on the build machine; registry account; **`docker login`** (or GHCR equivalent) before push.
- **Git Bash** on Windows for shell scripts: `C:\Program Files\Git\bin\bash.exe` (do not rely on the Store `bash` if it points at a broken WSL).
- **`deployment/.env`** from `deployment/.env.example` with `REGISTRY_PROVIDER`, credentials, and (for pushes) consistent `IMAGE_TAG` semantics — scripts override tag from the CLI where documented.

### B1 — Build, push, deploy (registry slab)

**On the build machine** (repo root, SHA = commit you will deploy, must be on `main`):

```powershell
# Windows helper (recommended)
.\deploy-registry.ps1 -Action BuildPush -Commit <optional-sha>

# Or manually with Git Bash:
#   cd /c/Users/NUMERI/NUMZFLEET   # adjust drive/path
#   SHA=$(git rev-parse HEAD)
#   ./deployment/build/build-frontend.sh "$SHA"
#   ./deployment/build/build-backend.sh "$SHA"
#   docker login   # if needed
#   ./deployment/push/push-images.sh deployment/.env "$SHA"
```

**On the target host** (repo checkout optional; need `deployment/.env` and Docker):

```bash
./deployment/deploy/deploy-from-registry.sh <same-SHA> [path/to/env]
./deployment/deploy/rollback.sh   # after at least two deploys recorded
```

**Compose file for B1:** `deployment/compose/docker-compose.prod.yml` (ports **3002** → frontend, **3001** → fuel API). Backend env file path in that compose points at **`../../backend/.env`** — ensure that file exists on the host or adjust compose for your layout.

### B2 — Hybrid integration checklist (production, when you adopt it)

Do this in a **maintenance window** or on a **staging clone** first.

1. **Images:** Build and push `numztrak-frontend` and `numztrak-backend` at the SHA you will run (same as `git checkout` on the server).
2. **Fuel API:** In `backend/docker-compose.prod.yml`, switch `fuel-api` from `build:` to `image: ${REGISTRY_PREFIX}/numztrak-backend:${IMAGE_TAG}` (or your namespace), add `pull_policy: always` if desired, and keep the same `environment` / `env_file` / `networks` / `depends_on` as today.
3. **Frontend:** Today nginx serves `../traccar-fleet-system/frontend/dist` from the host. To use the registry frontend container instead:
   - Run a service based on `numztrak-frontend:<SHA>` on `numztrak-network` (e.g. internal port 80).
   - Change `backend/nginx/nginx.prod.conf` to `proxy_pass` (or `try_files` only for special paths) to that upstream instead of only `root` for the SPA.
   - Remove or stop using the bind-mounted `dist` volume for production static files once verified.
4. **Flow A script:** Update the remote steps in `release-prod.ps1` so phase “build frontend on server” becomes **pull frontend image + restart** that service, and **pull** fuel-api instead of `--build` where applicable — or run a small server-side script that mirrors `deploy-from-registry.sh` for only those services inside `~/NUMZFLEET/backend`.
5. **Rollback:** Keep `.\release-prod.ps1 -Commit <sha>` for git-level rollback; for images, re-pull the previous tag or run `deployment/deploy/rollback.sh` if you use the registry deploy recorder on that host.

Until B2 is done, **Flow A remains the production default**; Flow B is valid for **B1** and for preparing images.

---

## Quick decision table

| Goal | Flow |
|------|------|
| Normal prod release (full stack, current nginx + dist mount) | **A** — `.\release-prod.ps1` |
| Rollback prod to previous commit | **A** — `.\release-prod.ps1 -Commit <prev>` |
| Staging / minimal host with only SPA + Fuel API | **B1** — registry build/push + `deploy-from-registry.sh` |
| Fast iteration on images only (future prod) | **B2** — follow hybrid checklist, then combine with **A** for the rest |

---

## CI (GitHub)

- **`release-gate.yml`:** required quality gate on `main` (frontend lint/build, nginx check, etc.).
- **`deploy-frontend.yml`:** on `main` with frontend path changes, CI may build and rsync `dist/` — that is a **frontend-only** automation path; it is not the same as Track B registry images unless you align it deliberately.

---

## File map

| Piece | Path |
|--------|------|
| Full-stack Windows entrypoint | `release-prod.ps1` |
| Production compose (full stack) | `backend/docker-compose.prod.yml` |
| Registry compose stub (slab) | `deployment/compose/docker-compose.prod.yml` |
| Build / push / deploy shell scripts | `deployment/build/`, `deployment/push/`, `deployment/deploy/` |
| Registry env template | `deployment/.env.example` |
| Windows helper for Track B | `deploy-registry.ps1` (repo root) |
| Routing contract | `ROUTING.md` |
| DB migrations | `fuel-api/docs/DATABASE_MIGRATIONS.md` |

---

## Changelog

- **2026-04-30:** Flow A **registry fast path** on `release-prod.ps1` (`-UseRegistryAppImages`, `-RegistryImagePrefix`); `fuel-api` optional `NUMZ_FUEL_API_IMAGE` in compose.
- **2026-04-30:** Initial authoritative flow (Flow A default, Flow B B1 + B2 checklist).
