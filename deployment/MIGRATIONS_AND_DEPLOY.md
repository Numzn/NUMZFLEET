# Migrations and deploy — what actually runs

Operator truth table for **Postgres schema changes** vs **container image updates**.

**Current model:** NumzLab **dev** (hot reload via `./scripts/dev`) → **OCI production** (registry pull). Staging is **not used** — see [STAGING_RETIRED.md](STAGING_RETIRED.md).

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

| Path | Postgres target |
|------|-----------------|
| `deployment/utils/run-fuel-migrations.sh` | `POSTGRES_CONTAINER` (e.g. `numzfleet-dev-db`, `numzfleet-prod-db`) |
| `deployment/run-migrate-and-deploy.sh` | `numzfleet-prod-db` (OCI) |
| `deployment/deploy/full-production-deploy.sh` | `numzfleet-prod-db` (via `promote-to-production.sh`) |
| `fuel-api/scripts/apply-fuel-migrations.ps1` | Local Docker (Windows) |

### `auto_deploy.py` (NumzLab → SSH OCI)

| Mode | Remote script |
|------|----------------|
| **Production** (default, `NUMZFLEET_DIRECT_PRODUCTION=1`) | `run-migrate-and-deploy.sh` when `NUMZFLEET_USE_MIGRATIONS=1` |
| **Production** + `--no-migrations` | `deploy-from-registry.sh` only |
| **`--target staging`** | **Retired** — exits with error |

Production deploys run the **full** `MIGRATION_ORDER` list when migrations are enabled — not only files changed in the current commit.

## Typical production deploy sequence

```
1. Develop on NumzLab: ./scripts/dev (hot reload)
2. Commit + push; build/push images (SHA tag)
3. On NumzLab:
     python3 deployment/scripts/auto_deploy.py --target production --skip-git --deploy-image-tag <sha>
   Which SSHs to OCI and runs:
     a) All migrations (MIGRATION_ORDER)
     b) docker compose pull + up
     c) Health checks
```

## Environment variables

| Variable | Default (production) | Purpose |
|----------|----------------------|---------|
| `POSTGRES_CONTAINER` | `numzfleet-prod-db` | Run `psql` inside this container |
| `DATABASE_URL` | from `backend/.env` | Direct psql if no container |
| `POSTGRES_PASSWORD` | from `backend/.env` | Builds `DATABASE_URL` when unset |
| `SKIP_MIGRATIONS` | unset | Set `1` on `full-production-deploy.sh` to skip SQL |
| `NUMZFLEET_DIRECT_PRODUCTION` | `1` in `auto_deploy.env` | Direct OCI deploy (no staging gate) |

## Adding a new migration

1. Add `fuel-api/migrations/YYYYMMDD_description.sql` (idempotent SQL).
2. Append the filename to `fuel-api/migrations/MIGRATION_ORDER`.
3. Deploy with `run-migrate-and-deploy.sh` or `auto_deploy.py` (not `deploy-from-registry.sh` alone).
4. Local verify: `POSTGRES_CONTAINER=numzfleet-dev-db bash deployment/utils/run-fuel-migrations.sh`

See also: [fuel-api/docs/DATABASE_MIGRATIONS.md](../fuel-api/docs/DATABASE_MIGRATIONS.md), [REGISTRY_DEPLOY.md](REGISTRY_DEPLOY.md).
