# Staging stack — retired (for now)

NUMZFLEET is **not** using the registry-based **staging** stack (`docker-compose.staging.yml`, `deploy-to-staging.sh`, etc.) at the moment.

## Active environments

| Environment | Where | How |
|-------------|-------|-----|
| **Dev** | NumzLab | `./scripts/dev` — hot reload, bind mounts |
| **Production** | OCI | `auto_deploy.py --target production` or `run-migrate-and-deploy.sh` |

## Production deploy (from NumzLab)

```bash
cd /srv/projects/numzfleet
python3 deployment/scripts/auto_deploy.py \
  --target production \
  --skip-git \
  --deploy-image-tag <full-40-char-sha>
```

Config: `deployment/scripts/auto_deploy.env` (OCI SSH key, `NUMZFLEET_DIRECT_PRODUCTION=1`).

## Do not use

- `auto_deploy.py --target staging`
- `deployment/run-migrate-and-deploy-staging.sh`
- `deployment/deploy/deploy-to-staging.sh`
- `scripts/run-staging-deploy-homelab.sh`

These remain in the repo for reference only. `auto_deploy.py` **rejects** `--target staging`.

## Archived files (unchanged, not maintained)

- `deployment/compose/docker-compose.staging.yml`
- `deployment/.env.staging.example`
- `deployment/deploy/rollback-staging.sh`, `staging-smoke.sh`, etc.

To bring staging back later, restore the v3 flow in [REGISTRY_DEPLOY.md](REGISTRY_DEPLOY.md) historical section and re-enable `--target staging` in `auto_deploy.py`.
