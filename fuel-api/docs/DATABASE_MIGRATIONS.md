# Fuel API Database Migrations

This service uses SQL migration files under `fuel-api/migrations/` and Sequelize `sync` on startup when PostgreSQL is reachable.

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

## Verify migration state

```powershell
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='operation_sessions' ORDER BY ordinal_position;"
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='operation_session_refuels' ORDER BY ordinal_position;"
psql "$env:DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename='operation_sessions' ORDER BY indexname;"
```

After migration, expect operation-session totals columns, intelligent refuel columns, and the `idx_operation_sessions_one_active_per_user` index.
