# NUMZFLEET Development (NumzLab)

NumzLab is the **development workstation**. You edit code here via Cursor Remote SSH — not on your PC.

## Repository

| Item | Value |
|------|-------|
| Path | `/srv/projects/numzfleet` |
| GitHub | `https://github.com/Numzn/NUMZFLEET` |
| Branch | `main` (single branch — no `develop`, no staging) |

The PC folder `C:\Users\NUMERI\NUMZFLEET` is a **read-only backup**. Do not use it for active development.

## Daily workflow

```bash
cd /srv/projects/numzfleet
./scripts/dev          # start hot-reload stack
./scripts/logs         # follow logs
./scripts/stop         # stop stack
./scripts/verify       # health checks
```

Edit files in Cursor (Remote SSH). Frontend and backend reload automatically.

## Production release

Every push to `main` deploys to production automatically — there's no separate release step:

```bash
git add .
git commit -m "your message"
git push origin main
```

GitHub Actions (`.github/workflows/main.yml`) then runs quality checks, builds and pushes Docker images,
and deploys to OCI (`numz.site`) with a pre-migration backup and automatic rollback on failure. See
[deployment/REGISTRY_DEPLOY.md](../deployment/REGISTRY_DEPLOY.md) for the full pipeline.

## Access URLs (Tailscale)

| Service | URL |
|---------|-----|
| Fleet UI | http://fleet.numzlab or http://100.121.79.2:3003 |
| Fuel API | https://fleet.numzlab/api/health or http://100.121.79.2:3000/health |
| Traccar | http://track.fleet.numzlab or http://100.121.79.2:8082 |

Prerequisite: Tailscale Split DNS for domain `numzlab` → `100.121.79.2`.

## Environment files

| File | Purpose |
|------|---------|
| `backend/.env` | Secrets and DB credentials (gitignored) |
| `deployment/.env.dev` | Dev stack overrides (copy from `deployment/.env.dev.example`) |

## Backup before major changes

```bash
./scripts/backup
```

Backups go to `/srv/backups/databases/numzfleet/`.

## Architecture documents

| Document | Purpose |
|----------|---------|
| [docs/PLATFORM_ARCHITECTURE.md](PLATFORM_ARCHITECTURE.md) | **Frozen** platform tenancy, context, permissions, governance |
| [fuel-api/docs/ACCOUNTS_AND_TENANCY.md](../fuel-api/docs/ACCOUNTS_AND_TENANCY.md) | Operational request flow and troubleshooting |
| [docs/VEHICLE_ODOMETER_STANDARD.md](VEHICLE_ODOMETER_STANDARD.md) | Frozen vehicle odometer business language (M1) |

## GPS devices

Device protocols use host ports `5055`, `5001–5020` — not behind the HTTP gateway. Point devices at NumzLab **public or LAN IP**, not Tailscale.
