# NUMZFLEET Release Control Center

Operator dashboard for the single-branch production pipeline (`.github/workflows/main.yml`).
**Orchestration only** — all deploy logic stays in existing scripts.

## Quick start (Dev PC)

```bash
cd release-control-center

# 1. Configure secrets
cp config/rcc.env.example config/rcc.env
# Edit: RCC_API_TOKEN, GITHUB_TOKEN, DOCKERHUB_TOKEN, SSH paths

# Generate API token:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Install
npm install
npm install --prefix api
npm install --prefix ui

# 3. Run
npm run dev
```

- UI: http://127.0.0.1:5175
- API: http://127.0.0.1:3011

Log in with the `RCC_API_TOKEN` from `config/rcc.env`.

## Actions

Single branch (`main`), single pipeline: `git push origin main` builds, tests, and deploys automatically.
The actions below are break-glass / operator controls, not the normal path.

| Action | Command |
|--------|---------|
| Dev on NumzLab | `./scripts/dev` |
| Deploy production (break-glass) | `python deployment/scripts/auto_deploy.py --skip-git --deploy-image-tag <sha>` |
| Health check NumzLab | `./scripts/verify` or `./scripts/numzlab-healthcheck.sh` |
| Rollback production | SSH OCI `deployment/deploy/rollback.sh` (also happens automatically on a failed deploy) |

## Data sources (live)

- Production SHA via SSH state files on OCI (`.last_deploy`, `.deploy_history`, `.production_deploy_history`)
- GitHub Actions runs for `.github/workflows/main.yml` ("Production deploy")
- Docker Hub manifest checks (against `main`'s current HEAD)
- HTTP health probes (NumzLab Tailscale + OCI public URLs)

## Requirements

- Python 3 + `auto_deploy.py` dependencies
- `bash`, `ssh`, `git`, optional `docker` CLI
- Network: Tailscale to NumzLab, SSH to OCI, GitHub + Docker Hub API

See [deployment/REGISTRY_DEPLOY.md](../deployment/REGISTRY_DEPLOY.md) for the full pipeline.
