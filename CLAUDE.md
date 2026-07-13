# NUMZFLEET — Claude Code project instructions

Development runs on **NumzLab** at `/srv/projects/numzfleet`. Use Linux paths only.

@.cursor/rules/numzfleet-numztrak-workflow.mdc

## Branch & working-copy policy (read this first, every session)

This repo uses a **single-branch, no-worktree** development model. `main` is both the development
and production branch — `git push origin main` IS the deploy trigger (see below). There is no
`develop` branch and no staging environment, so isolating work in a worktree or feature branch
just works against the loop, not with it.

- The canonical working copy is `/srv/projects/numzfleet`. The canonical branch is `main`.
- Unless the user explicitly asks for isolated/parallel work, edit directly in the main working
  copy, on `main`. **Do not create or switch to worktrees. Do not create feature branches.**
- Testing/debugging must happen against this same working copy — it's what the running dev
  containers bind-mount, so edits are picked up immediately by `nodemon` (see Repository layout).
  A worktree is invisible to those containers, so verifying changes there proves nothing about the
  live dev app.
- Before editing any file this session, run:
  ```bash
  pwd
  git branch --show-current
  docker ps --format '{{.Names}}'
  ```
  Expect `pwd` = `/srv/projects/numzfleet`, branch = `main`, and the `numzfleet-dev-*` containers
  listed. If either the path or branch is wrong, **stop and tell the user before editing anything**
  — don't silently work around it by editing in whatever directory the session happened to start
  in.

## NumzLab workflow

Single branch: `main` is the only active development and production branch. There is no `develop`
branch and no staging environment.

```bash
cd /srv/projects/numzfleet
./scripts/dev          # hot-reload stack
./scripts/verify       # health checks
./scripts/logs         # follow logs
./scripts/stop         # stop stack
./scripts/backup       # DB backup before major changes
```

- NumzLab is the development environment (hot reload, local verification).
- `git push origin main` triggers the real automated production pipeline (`.github/workflows/main.yml`):
  quality checks → build 3 images → push Docker Hub → verify manifests → SSH to OCI → pre-deploy checks
  → pre-migration backup → migrations → pull SHA images → `up -d --wait` → internal + public health
  checks → auto-rollback on failure. See `deployment/REGISTRY_DEPLOY.md` for the full pipeline.
- PC path `C:\Users\NUMERI\NUMZFLEET` is read-only backup — do not use for active dev

## Repository layout

| Path | Purpose |
|------|---------|
| `fuel-api/` | Backend API (Postgres `numztrak_fuel`, port 3000) |
| `traccar-fleet-system/` | Frontend (Vite, port 3003) |
| `erb-fuel-monitor/` | ERB fuel price scraper |
| `backend/` | Traccar runtime assets |
| `deployment/compose/` | `docker-compose.dev.yml` (dev), `docker-compose.prod.yml` (OCI) |
| `scripts/` | `dev`, `stop`, `logs`, `verify`, `backup` |

Dev containers use prefix `numzfleet-dev-*`; production containers use prefix `numzfleet-prod-*`.

## Access URLs (Tailscale)

| Service | URL |
|---------|-----|
| Fleet UI | http://fleet.numzlab or http://100.121.79.2:3003 |
| Fuel API | http://api.fleet.numzlab or http://100.121.79.2:3000 |
| Traccar | http://track.fleet.numzlab or http://100.121.79.2:8082 |

## Domain docs (read before large changes)

- @docs/DEVELOPMENT.md
- @docs/PLATFORM_ARCHITECTURE.md
- @fuel-api/docs/OPERATION_SESSIONS_API.md
- @fuel-api/docs/ACCOUNTS_AND_TENANCY.md
- @fuel-api/docs/ERB_INTEGRATION.md

## Homelab boundary

DNS, Caddy gateway, Tailscale, and backups live in the separate **HOMESERVER** repo (`/srv/infrastructure/`). Do not mix homelab infra changes into NUMZFLEET commits.

## Assistant habits on NumzLab

- Shell: bash on Ubuntu — not PowerShell (ignore Windows-first hints in legacy rules when they conflict)
- Prefer `./scripts/dev` over inventing raw `docker compose` sequences
- Ask before editing files unless the user requested implementation
- Run full builds only when asked for build, deploy, or CI verification
