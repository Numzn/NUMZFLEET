# Debug Fuel

## When to use

- Fuel Day / operation session issues (create, approve, refuel rows, invoices).
- ERB price integration failures.
- Refuel status, odometer capture at pump, fuel learning.
- "NumzLab connection" or fuel-api errors in fleet UI.

## Domain map

| Concept | Tables / services |
|---------|-------------------|
| Fuel Day | `operation_sessions` |
| Refuel rows | `operation_session_refuels` |
| Invoices | `operation_session_invoices` |
| Vehicle fuel spec | `vehicle_specs` |
| Fuel learning | `vehicle_fuel_learning` |
| Session API | `fuel-api/src/services/operationSession*.js` |
| Refuel records | `fuel-api/src/services/operationRefuelRecordService.js` |
| Aggregation | `fuel-api/src/intelligence/AggregationEngine.js` |

## Data flow

```text
Fuel Day session → refuel rows per vehicle → invoices (multi-invoice supported)
       ↓
Vehicle Engine fuel hub ← telemetry fuel % + spec + last refuel
       ↓
Fleet UI (Fuel tab, Fuel Day workflows, ERB insight card)
```

## Debug steps

### 1. Health check

```bash
curl -fsS http://localhost:3000/health
# or via frontend proxy
curl -fsS https://fleet.numzlab/api/health
```

### 2. Schema / migrations

Many fuel errors are missing tables/columns. Check [fuel-api-migration.md](fuel-api-migration.md).

Quick probe:

```bash
docker exec numzfleet-dev-db psql -U numztrak -d numztrak_fuel \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='operation_sessions' ORDER BY 1;"
```

### 3. ERB prices

- Env: `backend/.env` — `ERB_API_TOKEN`, relay settings.
- Token sync: `ensure-erb-token.ps1` (runs during rebuild).
- Docs: [fuel-api/docs/ERB_INTEGRATION.md](../../../fuel-api/docs/ERB_INTEGRATION.md)
- UI: `ErbInsightCard.jsx` — check `erbState.error` path in `useVehicleData`.

### 4. Traccar dependency

fuel-api may start **degraded** if Traccar MySQL is down — some sync paths skip. Ensure Traccar is healthy in compose.

### 5. Tenant scoping

Fuel routes require valid `company_id` context. Missing column → run `20260616_multi_tenant_foundation.sql`.

### 6. Logs

```bash
docker compose logs -f backend
# NumzLab
./scripts/logs
```

Look for operation session errors, ERB fetch failures, refuel validation rejects.

### 7. API smoke

Docs: [fuel-api/docs/OPERATION_SESSIONS_API.md](../../../fuel-api/docs/OPERATION_SESSIONS_API.md)

## Common errors

| Error / symptom | Check |
|-----------------|-------|
| `relation "operation_sessions" does not exist` | Run baseline migration `20260503_…` |
| Refuel won't save | Refuel status enum, odometer capture rules (`20260702_refuel_odometer_capture.sql`) |
| Wrong fuel type price | ERB snapshot columns on session (`20260620_fuel_operations_phase1.sql`) |
| Fuel % vs measured mismatch | Telemetry hub vs `vehicle_specs` — see [debug-telemetry.md](debug-telemetry.md) |
| Save failed — NumzLab connection | fuel-api down, CORS, or auth cookie |

## UI entry points

- `VehicleFuelTab.jsx`, `VehicleFuelColumn.jsx`, `FuelCard.jsx`
- `FuelSetupModule.jsx` for vehicle spec (tank, consumption, thresholds)
- Fuel requests: gated by `numz.enableFuelRequests` flag

## Fix discipline

- Fuel **writes** stay in fuel module services.
- Dashboard **reads** use Vehicle Engine — don't duplicate efficiency/KPI math in UI.
