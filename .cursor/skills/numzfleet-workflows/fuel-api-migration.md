# Fuel API Migration

## When to use

- Adding or applying Postgres schema changes for fuel-api.
- Errors like `column "company_id" does not exist` or `relation "operation_sessions" does not exist`.
- Preparing a production deploy that includes SQL changes.

## Single source of truth

| Artifact | Role |
|----------|------|
| `fuel-api/migrations/*.sql` | Idempotent SQL |
| `fuel-api/migrations/MIGRATION_ORDER` | **Canonical apply order** (not alphabetical) |
| `deployment/utils/fuel-migrations-lib.sh` | Shared runner |

**Rule:** every new `*.sql` **must** be appended to `MIGRATION_ORDER`. CI fails on manifest drift.

## Adding a migration

1. Create `fuel-api/migrations/YYYYMMDD_description.sql` — idempotent (`IF NOT EXISTS`, safe re-run).
2. Append filename to `fuel-api/migrations/MIGRATION_ORDER`.
3. Verify locally (see below).
4. Deploy with `run-migrate-and-deploy.sh` — **not** `deploy-from-registry.sh` alone.

## Apply locally

**NumzLab (bash):**

```bash
POSTGRES_CONTAINER=numzfleet-dev-db bash deployment/utils/run-fuel-migrations.sh
```

**Does NOT auto-apply on:**

- `./scripts/dev` (hot reload)
- `deploy-from-registry.sh`

Sequelize `sync` on startup does **not** replace SQL migrations for production.

## Production

`run-migrate-and-deploy.sh` runs the **full** `MIGRATION_ORDER` list before image pull.

Env defaults:

| Variable | Production default |
|----------|-------------------|
| `POSTGRES_CONTAINER` | `numzfleet-prod-db` |
| `BACKEND_CONTAINER` | `numzfleet-prod-fuel-api` |

## Safety

Deploy scripts block destructive SQL (`TRUNCATE`, `DROP TABLE/DATABASE/SCHEMA/COLUMN/TYPE`). Non-destructive `DROP INDEX` / `DROP CONSTRAINT` is allowed.

## Verify state

```bash
docker exec <postgres-container> psql -U numztrak -d numztrak_fuel -c "\d vehicles"
```

Expect `company_id` after `20260616_multi_tenant_foundation.sql`.

## Related docs

- [fuel-api/docs/DATABASE_MIGRATIONS.md](../../../fuel-api/docs/DATABASE_MIGRATIONS.md)
- [deployment/MIGRATIONS_AND_DEPLOY.md](../../../deployment/MIGRATIONS_AND_DEPLOY.md)
