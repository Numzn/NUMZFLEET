# Immobilization intent engine

Safety-governed operational intents: fuel-api evaluates conditions, Traccar delivers `engineStop` / `engineResume`.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `TRACCAR_SERVER_URL` | `http://traccar:8082` | Traccar base URL for server-side HTTP (also `TRACCAR_API_BASE_URL`) |
| `TRACCAR_API_USER` | — | Service account email (Basic auth) — dedicated Traccar user, not per-operator login |
| `TRACCAR_API_PASSWORD` | — | Service account password |
| `TRACCAR_API_TIMEOUT_MS` | `20000` | Bound on every Traccar command-API HTTP call (capabilities + send). Must stay comfortably below `EXECUTION_CLAIM_TIMEOUT_SEC` — see below |

These same three variables power **Routine Service** Traccar schedule create/update from Vehicle Setup (`PUT /api/vehicles/:id/routine-service`). No extra credentials required.

Create the user in Traccar (**Settings → Users**) before expecting capabilities to load. Wrong or missing credentials return `blockedReason: traccar_service_account_auth_failed` with `commandApiConfigured: true`.
| `IMMOBILIZATION_EVALUATOR_INTERVAL_MS` | `2000` | Evaluator tick; `0` disables |
| `IMMOBILIZATION_EVALUATOR_STARTUP_DELAY_MS` | `5000` | Delay before first tick |
| `EXECUTION_CLAIM_TIMEOUT_SEC` | `45` | Stuck `executing` without Traccar delivery → `failed` |
| `IMMOBILIZATION_RECONCILE_ON_STARTUP` | `1` | Run `reconcileStuckExecuting()` once after DB sync |
| `IMMOBILIZATION_USE_ADVISORY_LOCK` | `1` | `pg_try_advisory_lock` per evaluator tick (multi-replica) |
| `IMMOBILIZATION_ACK_PROBE` | `1` | After `sent`, query Traccar `tc_events` for `commandResult` → `relay_reported` |
| `IMMOBILIZATION_ACK_PROBE_WINDOW_SEC` | `900` | How long to keep *retrying* the sweep for a `sent` intent (late ACKs happen) |
| `IMMOBILIZATION_ACK_MATCH_WINDOW_SEC` | `120` | How close a `commandResult` event must land to `traccarDeliveryAt` to plausibly *be* this command's result — see "Device ACK correlation" below |

## P0 execution guarantees

- **At most one Traccar POST per intent row** — atomic `UPDATE … WHERE status IN ('pending','monitoring')` claim before POST.
- **Cancel only before claim** — `pending` / `monitoring` only; `executing` returns HTTP 409.
- **Stuck `executing` resolves** — watchdog fails claim without delivery after timeout, or completes if `traccarDeliveryAt` set.
- **Honest delivery confidence** — HTTP 2xx sets `confidence: sent` (not device ACK). Legacy `acknowledged` rows treated the same in UI.
- **Bounded Traccar HTTP calls** — `traccarFetch` aborts after `TRACCAR_API_TIMEOUT_MS` (default 20s). This is the primary defense against a stalled/hung Traccar relay: the evaluator processes intents one at a time per tick, so an unbounded call would stall the entire fleet's evaluation, not just one intent. On timeout, the intent still lands on the state machine's only terminal-failure state (`failed` — no "unknown" state exists), but `executionError: traccar_delivery_unknown_timeout`, `deliveryPhase: delivery_unknown`, `confidence: unverified` say plainly that we gave up waiting, not that Traccar rejected the command. **`TRACCAR_API_TIMEOUT_MS` must stay comfortably below `EXECUTION_CLAIM_TIMEOUT_SEC`** (default 20s vs 45s, 15s+ margin) so our own bounded call always finishes and finalizes the row before the claim watchdog would otherwise have to guess. Do not close that gap by raising the command timeout toward the watchdog's, or by lowering the watchdog below the command timeout — either masks the race instead of resolving it.
- **DB constraint is the concurrency authority, not the app-level check** — `createIntent`'s pre-check (`findOne` for an existing active intent) is a fast path, not a lock. Two concurrent immobilize/mobilize requests can both pass it; the partial unique index (`vehicle_immobilization_intents_one_active_per_vehicle`) is what actually prevents two active rows. A losing `INSERT` is caught (`SequelizeUniqueConstraintError` / Postgres `23505`) and translated into the same `409 { existingIntent }` response the pre-check gives — see `immobilization/uniqueConstraintError.js`.
- **Notifications never change the outcome of a state transition** — every `notifyImmobilizationTransition` call (cancel, expire, complete, fail) goes through `immobilization/safeNotify.js`, which swallows and logs (`immobilization.notify.failed`) rather than propagating. A DB transition that already committed must be reported as a success even if the follow-on inbox/SMS/websocket notification fails.
- **`effectiveStatus` is computed live, `status` is the durable record** — `pending`/`monitoring` rows only advance to `expired` in the database when the evaluator ticks. Every API response also includes `effectiveStatus` (`immobilization/effectiveStatus.js`), and the active-intent lookup / one-active-per-vehicle conflict check both use it, so an intent that's past `expiresAt` but not yet swept can no longer block a new immobilize request or appear "active" in the UI. Reads never mutate the row — only the evaluator writes `expired`.

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
| `claim_timeout` | `executing` too long without `traccarDeliveryAt` — reached only via crash/restart recovery now that the command call itself is bounded well under this watchdog | Check Traccar command log; do not assume command failed if Traccar shows success |
| `traccar_delivery_unknown_timeout` | Our own bounded HTTP call (`TRACCAR_API_TIMEOUT_MS`) gave up waiting for a response | Check Traccar command log before assuming failure — the command may have reached the device; outcome is genuinely unverified |
| `device_reassigned` | Active assignment changed after claim | Create new intent on correct device |
| `traccar_http_rejected` | Traccar HTTP non-2xx (a real response was received) | Check connectivity, protocol, command support |
| `claim_lost_race` | Another replica/tick claimed first | Refresh UI |
| `reconciled_complete` | Recovery completed row after partial delivery | Informational |

### Stuck `executing`

1. Check row: `status`, `executionStartedAt`, `traccarDeliveryAt`, `deliveryPhase`.
2. If `traccarDeliveryAt` set but not `completed` — next reconcile tick should complete (`reconciled_complete`).
3. If no `traccarDeliveryAt` and age > `EXECUTION_CLAIM_TIMEOUT_SEC` — becomes `failed` / `claim_timeout`.
4. Manually verify in Traccar UI → device → commands / events before re-requesting.

### P1 delivery persist

After Traccar HTTP 2xx, `recordTraccarDeliveryAccepted()` writes `traccarDeliveryAt` while still `executing`, then `finalizeExecutingIntent()` sets `completed`. A crash between those steps no longer produces a false `claim_timeout` if Traccar accepted the command.

### Device ACK correlation (`relay_reported`)

When `IMMOBILIZATION_ACK_PROBE=1`, fuel-api reads Traccar MySQL `tc_events` (`type = commandResult`) after `traccarDeliveryAt`. Matching results upgrade `confidence` from `sent` to `relay_reported`. Not all protocols emit `commandResult`; absence does not mean failure.

**Ground truth (verified against a real Traccar install, not assumed):** `tc_events.attributes` for a `commandResult` row is raw protocol text with no command identifier at all — e.g. `{"result":"S20,OK,190531"}`. Traccar does not give us anything stronger than `deviceId` + `eventtime` + free text to correlate a result back to a specific command. Given that ceiling, correlation (`immobilization/deviceCommandOutcomeProbe.js`) is deliberately conservative rather than optimistic:

1. **Bounded plausibility window** (`selectPlausibleAckEvents`) — only events between `traccarDeliveryAt` and `traccarDeliveryAt + IMMOBILIZATION_ACK_MATCH_WINDOW_SEC` (default 120s) are even considered, closest-first. An event minutes later is not treated as "the most recent, so it must be ours" — it's out of window entirely.
2. **No competing delivery in between** (`hasCompetingDeliveryBetween`) — if any *other* intent on the same device was delivered between our `traccarDeliveryAt` and the candidate event's `eventtime`, the event is ambiguous (it could just as plausibly be that other command's result) and is refused, logged as `immobilization.intent.ack_ambiguous`. This is the guard that stops two intents on the same device (e.g. immobilize then a later mobilize) from both claiming the same stray event, or the wrong one claiming it.
3. **Still not failure-shaped text** (`commandResultLooksLikeAck`, unchanged) — explicit failure/error/reject wording never upgrades confidence, regardless of timing.

For `custom`-type commands (the only type most of this fleet's devices actually support — protocol text is inherently unparseable generically) the text check stays permissive; guards 1–2 are what keep a stray event from being misattributed, not smarter text parsing. This is a correlation strategy fitted to what Traccar actually exposes, not a workaround pending a "real" command-id field — one doesn't exist to use.

### Operator expectations

- **Sent** = tracking server accepted the HTTP command, not physical immobilization.
- **Relay reported** = tracker reported a command result event; still verify operationally if required.
- Cancel is unavailable while `executing` (HTTP 409).
- Unstable GSM may reset safety timers — immobilize can take longer by design.
