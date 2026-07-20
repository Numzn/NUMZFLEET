# Deploy Production

## When to use

- User says **deploy to production/server/OCI**, release to `numz.site`, or promote a SHA to production.

## Model (single path)

Registry-based: CI builds and pushes SHA-tagged images. Servers **pull + up** — never `docker compose build` on OCI.

| Image | Tag |
|-------|-----|
| `numzfleet-frontend` | full git SHA |
| `numzfleet-backend` | full git SHA |
| `numzfleet-erb` | full git SHA |

Workflow: [.github/workflows/build-push-numzfleet-images.yml](../../../.github/workflows/build-push-numzfleet-images.yml)

## Deploy commands

**With migrations** (preferred when `fuel-api/migrations/` changed):

```bash
./deployment/run-migrate-and-deploy.sh <full-git-sha> deployment/.env
```

**Without migrations** (image-only update):

```bash
bash deployment/deploy/deploy-from-registry.sh <full-git-sha> deployment/.env
```

**From NumzLab** (SSH to OCI):

```bash
python3 deployment/scripts/auto_deploy.py \
  --target production \
  --skip-git \
  --deploy-image-tag <full-git-sha>
```

Use `--no-migrations` with `auto_deploy.py` only when schema is unchanged.

## Release flow (typical)

1. Develop on NumzLab: `./scripts/dev`
2. Commit/push to `develop`; open PR to `main` via `./scripts/release`
3. Merge to `main` → GitHub Actions builds and pushes images
4. Deploy SHA with `run-migrate-and-deploy.sh` or `auto_deploy.py`

Branches: `develop` (dev), `main` (production). Pushes to `develop` do **not** auto-deploy production.

## Staging

**Retired.** Do not use `deploy-to-staging.sh` or `--target staging`. See [deployment/STAGING_RETIRED.md](../../../deployment/STAGING_RETIRED.md).

## After failure

Only then use targeted follow-up:

```bash
docker compose logs <service>
```

## Related docs

- [deployment/REGISTRY_DEPLOY.md](../../../deployment/REGISTRY_DEPLOY.md)
- [deployment/MIGRATIONS_AND_DEPLOY.md](../../../deployment/MIGRATIONS_AND_DEPLOY.md)
- [docs/NUMZLAB_DEPLOYMENT.md](../../../docs/NUMZLAB_DEPLOYMENT.md)
