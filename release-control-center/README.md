# NUMZFLEET Release Control Center

Operator dashboard for Release Pipeline v3. **Orchestration only** — all deploy logic stays in existing scripts.

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

| Button | Command |
|--------|---------|
| Deploy to NumzLab | `python deployment/scripts/auto_deploy.py --target staging` |
| Run Verification | SSH `numzlab-healthcheck.sh`, `staging-smoke.sh`, `verify-docker-manifests.sh`, `verify-staging-promotion.sh` |
| Promote to Production | `auto_deploy.py --target production --promoted-sha <sha> --skip-git` |
| Rollback Production | SSH OCI `deployment/deploy/rollback.sh` |

## Data sources (live)

- Staging/production SHA via SSH state files on NumzLab and OCI
- GitHub Actions workflow runs and staging deployments API
- Docker Hub manifest checks
- HTTP health probes (NumzLab Tailscale + OCI public URLs)

## Requirements

- Python 3 + `auto_deploy.py` dependencies
- `bash`, `ssh`, `git`, optional `docker` CLI
- Network: Tailscale to NumzLab, SSH to OCI, GitHub + Docker Hub API

See [RELEASE_PIPELINE_V3.md](../docs/RELEASE_PIPELINE_V3.md) for pipeline rules.
