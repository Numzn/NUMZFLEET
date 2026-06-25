# NUMZFLEET Development (NumzLab)

NumzLab is the **development workstation**. You edit code here via Cursor Remote SSH — not on your PC.

## Repository

| Item | Value |
|------|-------|
| Path | `/srv/projects/numzfleet` |
| GitHub | `https://github.com/Numzn/NUMZFLEET` |
| Dev branch | `develop` |
| Production branch | `main` |

The PC folder `C:\Users\NUMERI\NUMZFLEET` is a **read-only backup**. Do not use it for active development.

## Daily workflow

```bash
cd /srv/projects/numzfleet
git checkout develop
./scripts/dev          # start hot-reload stack
./scripts/logs         # follow logs
./scripts/stop         # stop stack
./scripts/verify       # health checks
```

Edit files in Cursor (Remote SSH). Frontend and backend reload automatically.

Commit and push from NumzLab:

```bash
git add .
git commit -m "your message"
git push origin develop
```

Pushes to `develop` do **not** deploy to production.

## Access URLs (Tailscale)

| Service | URL |
|---------|-----|
| Fleet UI | http://fleet.numzlab or http://100.121.79.2:3003 |
| Fuel API | http://api.fleet.numzlab/health or http://100.121.79.2:3000/health |
| Traccar | http://track.fleet.numzlab or http://100.121.79.2:8082 |

Prerequisite: Tailscale Split DNS for domain `numzlab` → `100.121.79.2`.

## Production release

```bash
./scripts/release      # opens PR develop → main
```

After merge to `main`, GitHub Actions builds Docker images, pushes to Docker Hub, and deploys to OCI (`numz.site`).

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

## GPS devices

Device protocols use host ports `5055`, `5001–5020` — not behind the HTTP gateway. Point devices at NumzLab **public or LAN IP**, not Tailscale.
