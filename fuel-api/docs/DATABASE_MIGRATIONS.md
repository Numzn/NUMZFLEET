# Fuel API Database Migrations

SQL migrations live under `fuel-api/migrations/`. **Apply order is defined in `fuel-api/migrations/MIGRATION_ORDER`** (not alphabetical). Deploy scripts read that file only — see [deployment/MIGRATIONS_AND_DEPLOY.md](../../deployment/MIGRATIONS_AND_DEPLOY.md) for which deploy paths run migrations.

Future platform migrations (companies lifecycle, `platform_audit_events`, etc.) must align with [docs/PLATFORM_ARCHITECTURE.md](../../docs/PLATFORM_ARCHITECTURE.md).

Sequelize `sync` on startup does **not** replace these SQL files for production schema changes.

## Apply all migrations (local Docker — recommended)

With the stack up (`docker compose up -d db` or full `.\rebuild-stack.ps1`):

```powershell
.\fuel-api\scripts\apply-fuel-migrations.ps1
```

This runs every migration in `MIGRATION_ORDER` (idempotent). Production/staging use the same list via `deployment/utils/fuel-migrations-lib.sh`.

## If you see `column "company_id" does not exist`

Fleet vehicles and other fuel-api routes scope data by `company_id`. That column comes from **`20260616_multi_tenant_foundation.sql`**.

**Fix:** run the full migration script above, or only:

```powershell
docker cp fuel-api/migrations/20260616_multi_tenant_foundation.sql numzfleet-db-1:/tmp/m.sql
docker exec numzfleet-db-1 psql -U numztrak -d numztrak_fuel -v ON_ERROR_STOP=1 -f /tmp/m.sql
```

(Adjust container name if yours differs — `docker ps` and set `$env:POSTGRES_CONTAINER`.)

Verify:

```powershell
docker exec numzfleet-db-1 psql -U numztrak -d numztrak_fuel -c "\d vehicles"
```

Expect a `company_id` UUID column. Existing rows are backfilled to the default company `00000000-0000-0000-0000-000000000001`.

See also: [ACCOUNTS_AND_TENANCY.md](./ACCOUNTS_AND_TENANCY.md).

## If you see `relation "operation_sessions" does not exist`

The production database never had these tables (common if the API once started **degraded** while Traccar MySQL was down: older code skipped Postgres `sync` entirely). **Fix:** create tables, then restart the backend.

### 1) Baseline (creates `operation_sessions` + `operation_session_refuels` if missing)

From the repository root (or copy the file onto the server):

```powershell
psql "$env:DATABASE_URL" -f "C:\Users\NUMERI\NUMZFLEET\fuel-api\migrations\20260503_create_operation_sessions_tables.sql"
```

If `DATABASE_URL` is not set:

```powershell
psql "postgresql://numztrak:<password>@<host>:5432/numztrak_fuel" -f "C:\Users\NUMERI\NUMZFLEET\fuel-api\migrations\20260503_create_operation_sessions_tables.sql"
```

### 2) Then apply incremental migrations (safe to re-run)

If the tables **already existed** from an older install and only need new columns / enum values:

```powershell
psql "$env:DATABASE_URL" -f "C:\Users\NUMERI\NUMZFLEET\fuel-api\migrations\20260427_daily_intelligent_refueling.sql"
psql "$env:DATABASE_URL" -f "C:\Users\NUMERI\NUMZFLEET\fuel-api\migrations\20260429_refuel_status_incomplete.sql"
```

## Apply the operation session column migration (existing installs)

Run this from the repository root:

```powershell
psql "$env:DATABASE_URL" -f "C:\Users\NUMERI\NUMZFLEET\fuel-api\migrations\20260427_daily_intelligent_refueling.sql"
```

If `DATABASE_URL` is not set, pass it directly:

```powershell
psql "postgresql://numztrak:<password>@<host>:5432/numztrak_fuel" -f "C:\Users\NUMERI\NUMZFLEET\fuel-api\migrations\20260427_daily_intelligent_refueling.sql"
```

## Why these migrations are safe to re-run

`20260503_create_operation_sessions_tables.sql` uses `IF NOT EXISTS` for tables and indexes. `20260427_daily_intelligent_refueling.sql` uses `IF NOT EXISTS` for new columns and indexes where applicable, so repeated execution is idempotent for those objects.

## Fuel Operations Phase 1

`20260620_fuel_operations_phase1.sql` adds the Fuel Day station name and per-fuel-type ERB price snapshots (`stationName`, `approvedDieselPrice`, `approvedPetrolPrice` on `operation_sessions`), a `fuelTypeSnapshot` column on `operation_session_refuels`, the `operation_session_invoices` reconciliation table, and verified-odometer baseline columns on `vehicle_specs` (`verifiedOdometerKm`, `verifiedOdometerAt`, `verifiedOdometerSource`, `verifiedTraccarDistance`). It is idempotent and included in the apply scripts and deploy migration list.

## Fueling Day multi-invoice + arrived

`20260621_fueling_day_multi_invoice_arrived.sql` lets a single Fuel Day carry several Smart Invoices: it removes the 1:1 unique index/constraint on `operation_session_invoices."operationId"` and replaces it with a plain lookup index, and it adds `operation_session_refuels."arrivedAt"` so a vehicle can be marked as arrived at the pump before fuel is recorded. It is idempotent and included in the apply scripts and deploy migration list.

Note: the deploy safety guard (`forbidden_sql_check` in `deployment/run-migrate-and-deploy*.sh`) blocks destructive statements (`TRUNCATE` and `DROP TABLE/DATABASE/SCHEMA/COLUMN/TYPE`) but permits non-destructive `DROP INDEX` / `DROP CONSTRAINT`, which this migration relies on.

## Notification inbox (PR1)

Idempotent; safe after `20260512_notifications.sql` baseline:

```powershell
.\fuel-api\scripts\apply-notification-migrations.ps1
```

Or manually:

```powershell
psql "$env:DATABASE_URL" -f "fuel-api/migrations/20260512_notifications.sql"
psql "$env:DATABASE_URL" -f "fuel-api/migrations/20260522_notifications_dedup_and_bridge.sql"
```

Enable bridge in `backend/.env`: `TRACKING_NOTIFICATION_BRIDGE=1` (see `backend/.env.example`).

Verify:

```powershell
docker exec numzfleet-backend-1 node scripts/verify-tracking-bridge.mjs
```

## Verify migration state

```powershell
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='operation_sessions' ORDER BY ordinal_position;"
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='operation_session_refuels' ORDER BY ordinal_position;"
psql "$env:DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename='operation_sessions' ORDER BY indexname;"
```

After migration, expect operation-session totals columns, intelligent refuel columns, and the `idx_operation_sessions_one_active_per_user` index.
