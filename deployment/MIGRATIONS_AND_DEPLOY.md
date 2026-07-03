# Migrations and deploy — what actually runs

Operator truth table for **Postgres schema changes** vs **container image updates**.

**Current model:** single branch, single pipeline. NumzLab **dev** (hot reload via `./scripts/dev`) → `git push origin main` → GitHub Actions builds/tests/pushes images → **OCI production** (registry pull). There is no staging environment — see [legacy/staging-archived/](../legacy/staging-archived/) for the retired v3 staging+promotion model.

## Single source of truth

| Artifact | Purpose |
|----------|---------|
| `fuel-api/migrations/*.sql` | Idempotent SQL migrations |
| `fuel-api/migrations/MIGRATION_ORDER` | **Canonical apply order** (one filename per line) |
| `deployment/utils/fuel-migrations-lib.sh` | Shared runner (safety checks + psql) |
| `deployment/utils/run-fuel-migrations.sh` | Manual: apply all migrations on NumzLab or OCI |

**Rule:** every new `*.sql` file **must** be appended to `MIGRATION_ORDER`. CI fails if manifest and files drift.

Migrations are **idempotent** — safe to re-run on every production deploy.

## What does *not* run migrations

| Path | Migrations? |
|------|-------------|
| `deployment/deploy/deploy-from-registry.sh` | **No** — pull images + `compose up` only |
| `./scripts/dev` (NumzLab hot reload) | **No** — bind mounts; DB unchanged |
| `rebuild-stack.ps1` / root `docker compose build` | **No** — local image build only |
| Sequelize `sync` on fuel-api startup | **Partial** — does not replace SQL migrations |

## What *does* run migrations (before image pull)

`deployment/deploy/full-production-deploy.sh` is the one script that runs the full sequence: it snapshots
the current DB (`baseline-backup.sh`, using the SHA still recorded in `.last_deploy`) **before** touching
anything, then applies migrations, then deploys, then verifies. If deploy or verification fails after the
snapshot, it automatically redeploys the previous SHA's images (migrations are additive and are **not**
reverted — same policy as `deployment/deploy/rollback.sh`).

| Path | Postgres target |
|------|-----------------|
| `deployment/utils/run-fuel-migrations.sh` | `POSTGRES_CONTAINER` (e.g. `numzfleet-dev-db`, `numzfleet-prod-db`) — manual, ad hoc |
| `deployment/run-migrate-and-deploy.sh` | `numzfleet-prod-db` (OCI) — break-glass, no backup/rollback wrapper |
| `deployment/deploy/full-production-deploy.sh` | `numzfleet-prod-db` — the path CI and `promote-to-production.sh` actually use |
| `fuel-api/scripts/apply-fuel-migrations.ps1` | Local Docker (Windows) |

### `auto_deploy.py` (workstation → SSH OCI, break-glass/manual path)

The normal path is `git push origin main` → GitHub Actions does everything (see [REGISTRY_DEPLOY.md](REGISTRY_DEPLOY.md)).
`auto_deploy.py` exists for manually triggering a deploy from a workstation without waiting on CI.

| Mode | Remote script |
|------|----------------|
| **Direct** (default, `NUMZFLEET_DIRECT_PRODUCTION=1`) | `run-migrate-and-deploy.sh` when `NUMZFLEET_USE_MIGRATIONS=1`, else `deploy-from-registry.sh` |
| **Promote** (`--promoted-sha <sha>`) | `promote-to-production.sh` → `full-production-deploy.sh` (backup + migrate + deploy + verify + auto-rollback) |

Production deploys run the **full** `MIGRATION_ORDER` list when migrations are enabled — not only files changed in the current commit.

## Typical production deploy sequence

```
1. Develop on NumzLab: ./scripts/dev (hot reload)
2. git add . && git commit && git push origin main
3. GitHub Actions (.github/workflows/main.yml):
     a) quality-checks (fuel-api tests, migration manifest, frontend build)
     b) build + push 3 SHA-tagged images to Docker Hub
     c) verify manifests exist
     d) SSH to OCI, run promote-to-production.sh -> full-production-deploy.sh:
          - pre-deploy checks
          - backup current DB (pre-migration snapshot)
          - apply migrations (MIGRATION_ORDER)
          - docker compose pull + up --wait
          - internal + public health checks
          - auto-rollback to previous SHA if any of the above fails
     e) curl public /health and /api/health from GitHub's runner
```

Manual break-glass equivalent (no CI wait):

```
python3 deployment/scripts/auto_deploy.py --skip-git --deploy-image-tag <full-git-sha>
```

## Environment variables

| Variable | Default (production) | Purpose |
|----------|----------------------|---------|
| `POSTGRES_CONTAINER` | `numzfleet-prod-db` | Run `psql` inside this container |
| `DATABASE_URL` | from `backend/.env` | Direct psql if no container |
| `POSTGRES_PASSWORD` | from `backend/.env` | Builds `DATABASE_URL` when unset |
| `SKIP_MIGRATIONS` | unset | Set `1` on `full-production-deploy.sh` to skip SQL |
| `NUMZFLEET_DIRECT_PRODUCTION` | `1` in `auto_deploy.env` | `auto_deploy.py`: direct OCI deploy, skip the promote wrapper |

## Adding a new migration

1. Add `fuel-api/migrations/YYYYMMDD_description.sql` (idempotent SQL).
2. Append the filename to `fuel-api/migrations/MIGRATION_ORDER`.
3. Deploy with `run-migrate-and-deploy.sh` or `auto_deploy.py` (not `deploy-from-registry.sh` alone).
4. Local verify: `POSTGRES_CONTAINER=numzfleet-dev-db bash deployment/utils/run-fuel-migrations.sh`

See also: [fuel-api/docs/DATABASE_MIGRATIONS.md](../fuel-api/docs/DATABASE_MIGRATIONS.md), [REGISTRY_DEPLOY.md](REGISTRY_DEPLOY.md).
