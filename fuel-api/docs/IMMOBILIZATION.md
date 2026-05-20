# Immobilization intent engine

Safety-governed operational intents: fuel-api evaluates conditions, Traccar delivers `engineStop` / `engineResume`.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `TRACCAR_SERVER_URL` | `http://traccar:8082` | Traccar base URL for command HTTP |
| `TRACCAR_API_USER` | — | Service account email (Basic auth) — dedicated Traccar user, not per-operator login |
| `TRACCAR_API_PASSWORD` | — | Service account password |

Create the user in Traccar (**Settings → Users**) before expecting capabilities to load. Wrong or missing credentials return `blockedReason: traccar_service_account_auth_failed` with `commandApiConfigured: true`.
| `IMMOBILIZATION_EVALUATOR_INTERVAL_MS` | `2000` | Evaluator tick; `0` disables |
| `IMMOBILIZATION_EVALUATOR_STARTUP_DELAY_MS` | `5000` | Delay before first tick |
| `EXECUTION_CLAIM_TIMEOUT_SEC` | `45` | Stuck `executing` without Traccar delivery → `failed` |
| `IMMOBILIZATION_RECONCILE_ON_STARTUP` | `1` | Run `reconcileStuckExecuting()` once after DB sync |
| `IMMOBILIZATION_USE_ADVISORY_LOCK` | `1` | `pg_try_advisory_lock` per evaluator tick (multi-replica) |
| `IMMOBILIZATION_ACK_PROBE` | `1` | After `sent`, query Traccar `tc_events` for `commandResult` → `relay_reported` |
| `IMMOBILIZATION_ACK_PROBE_WINDOW_SEC` | `900` | How long after completion to sweep `sent` intents for late ACKs |

## P0 execution guarantees

- **At most one Traccar POST per intent row** — atomic `UPDATE … WHERE status IN ('pending','monitoring')` claim before POST.
- **Cancel only before claim** — `pending` / `monitoring` only; `executing` returns HTTP 409.
- **Stuck `executing` resolves** — watchdog fails claim without delivery after timeout, or completes if `traccarDeliveryAt` set.
- **Honest delivery confidence** — HTTP 2xx sets `confidence: sent` (not device ACK). Legacy `acknowledged` rows treated the same in UI.

Execution safety does **not** depend on the advisory lock (claim does). The lock only reduces duplicate evaluate load when multiple fuel-api replicas run the scheduler.

## API (managers, under `/api/vehicles`)

- `GET /:vehicleId/immobilization/capabilities`
- `GET /:vehicleId/immobilization-intents/active`
- `GET /:vehicleId/immobilization-intents?limit=20`
- `POST /:vehicleId/immobilization-intents` body `{ "action": "immobilize" \| "mobilize" }` (requires real Traccar session)
- `POST /:vehicleId/immobilization-intents/:intentId/cancel`

## Database

Apply migrations (included in `deployment/run-migrate-and-deploy.sh`):

- `migrations/20260520_vehicle_immobilization_intents.sql`
- `migrations/20260521_immobilization_execution_integrity.sql` (execution metadata, `confidence: sent`)

## Fleet UI

`/fleet/vehicles/:vehicleId/immobilizer`

## Safety contract

Implemented in `src/immobilization/safetyContract.js`. Immobilize requires: online, fresh telemetry, speed ≤ 5 km/h (from knots), 10s speed stability, 15s connection stability, unexpired intent. Mobilize requires online + fresh telemetry only.

## State machine (do not add states)

| Status | Meaning |
|--------|---------|
| `pending` | Created |
| `monitoring` | Gates evaluated each tick |
| `executing` | Claimed; Traccar delivery in flight |
| `completed` | Terminal — HTTP path finished |
| `failed` | Terminal — claim/delivery/assignment failure |
| `expired` | Terminal — TTL without safe window |
| `cancelled` | Terminal — operator or mobilize supersede |

Use `deliveryPhase` for HTTP mechanics (`claimed`, `http_accepted`, `http_rejected`, `delivery_unknown`). Use `confidence` for delivery knowledge (`unknown`, `sent`, `relay_reported`, `unverified`).

## Execution timeline (support / audit)

Read intent row timestamps in order:

1. `createdAt` — operator request
2. `executionStartedAt` — atomic claim (`executing`)
3. `traccarDeliveryAt` — Traccar HTTP 2xx recorded (before terminal finalize; survives crash)
4. `executionCompletedAt` — terminal `completed` or `failed`

## Multi-replica fuel-api

Execution safety uses Postgres claim, not the advisory lock.

- **Default compose:** one `fuel-api` replica; advisory lock is harmless.
- **Multiple replicas:** keep `IMMOBILIZATION_USE_ADVISORY_LOCK=1` on all replicas **or** set `IMMOBILIZATION_EVALUATOR_INTERVAL_MS=0` on all but one replica.

Do not add a separate coordinator service.

## Operations runbook

### Before production

1. Apply SQL migrations (`20260520`, `20260521`) via `deployment/run-migrate-and-deploy.sh` or your migrate pipeline.
2. Set `TRACCAR_SERVER_URL`, `TRACCAR_API_USER`, `TRACCAR_API_PASSWORD` on fuel-api.
3. Confirm devices support `engineStop` / `engineResume` (immobilizer capabilities API).
4. Decide evaluator placement for replica count (above).

### Structured logs (JSON, stdout)

| Event | When |
|-------|------|
| `immobilization.evaluator.tick` | Each tick (`evaluated`, `claimed`, `delivered`, `durationMs`) |
| `immobilization.intent.claim` | Claim won/lost |
| `immobilization.intent.delivery` | HTTP recorded or terminal finalize |
| `immobilization.intent.reconcile` | Watchdog recovered stuck `executing` |
| `immobilization.intent.ack` | `confidence` upgraded to `relay_reported` |

Example grep:

```bash
docker compose logs fuel-api 2>&1 | grep immobilization.intent
docker compose logs fuel-api 2>&1 | grep '"intentId":"<uuid>"'
```

### `executionError` codes

| Code | Meaning | Operator action |
|------|---------|-----------------|
| `claim_timeout` | `executing` too long without `traccarDeliveryAt` | Check Traccar command log; do not assume command failed if Traccar shows success |
| `device_reassigned` | Active assignment changed after claim | Create new intent on correct device |
| `traccar_http_rejected` | Traccar HTTP non-2xx | Check connectivity, protocol, command support |
| `claim_lost_race` | Another replica/tick claimed first | Refresh UI |
| `reconciled_complete` | Recovery completed row after partial delivery | Informational |

### Stuck `executing`

1. Check row: `status`, `executionStartedAt`, `traccarDeliveryAt`, `deliveryPhase`.
2. If `traccarDeliveryAt` set but not `completed` — next reconcile tick should complete (`reconciled_complete`).
3. If no `traccarDeliveryAt` and age > `EXECUTION_CLAIM_TIMEOUT_SEC` — becomes `failed` / `claim_timeout`.
4. Manually verify in Traccar UI → device → commands / events before re-requesting.

### P1 delivery persist

After Traccar HTTP 2xx, `recordTraccarDeliveryAccepted()` writes `traccarDeliveryAt` while still `executing`, then `finalizeExecutingIntent()` sets `completed`. A crash between those steps no longer produces a false `claim_timeout` if Traccar accepted the command.

### Device ACK (`relay_reported`)

When `IMMOBILIZATION_ACK_PROBE=1`, fuel-api reads Traccar MySQL `tc_events` (`type = commandResult`) after `traccarDeliveryAt`. Matching results upgrade `confidence` from `sent` to `relay_reported`. Not all protocols emit `commandResult`; absence does not mean failure.

### Operator expectations

- **Sent** = tracking server accepted the HTTP command, not physical immobilization.
- **Relay reported** = tracker reported a command result event; still verify operationally if required.
- Cancel is unavailable while `executing` (HTTP 409).
- Unstable GSM may reset safety timers — immobilize can take longer by design.
