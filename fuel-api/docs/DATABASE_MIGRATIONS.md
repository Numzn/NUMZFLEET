# Fuel API Database Migrations

This service currently uses SQL migration files under `fuel-api/migrations/`.

## Apply the operation session migration

Run this from the repository root:

```powershell
psql "$env:DATABASE_URL" -f "C:\Users\NUMERI\NUMZFLEET\fuel-api\migrations\20260427_daily_intelligent_refueling.sql"
```

If `DATABASE_URL` is not set, pass it directly:

```powershell
psql "postgresql://numztrak:<password>@<host>:5432/numztrak_fuel" -f "C:\Users\NUMERI\NUMZFLEET\fuel-api\migrations\20260427_daily_intelligent_refueling.sql"
```

## Why this migration is safe to re-run

`20260427_daily_intelligent_refueling.sql` uses `IF NOT EXISTS` for new columns and indexes where applicable, so repeated execution is idempotent for those objects.

## Verify migration state

```powershell
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='operation_sessions' ORDER BY ordinal_position;"
psql "$env:DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='operation_session_refuels' ORDER BY ordinal_position;"
psql "$env:DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename='operation_sessions' ORDER BY indexname;"
```

After migration, expect operation-session totals columns, intelligent refuel columns, and the `idx_operation_sessions_one_active_per_user` index.
