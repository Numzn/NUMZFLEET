# Vehicle State Engine

`fuel-api/src/vehicleEngine/state/`

## Purpose

Single backend abstraction for "what is this vehicle's current operational
state" — `moving` / `idle` / `offline`, plus how long it's been there, how
confident we are in that duration, and any health flags worth surfacing.

This module was introduced to centralize *ownership*, not to change
behavior. Before this change, the audit (`project_dashboard_vehicle_state`
memory / prior investigation) found the canonical resolver
(`resolveActivityState()`) called independently from four-plus places
(`telemetryHub.js`, `fleetCommandCenterService.js`, `fleetSummaryService.js`,
`evaluateAndPersistActivityStates()`), each producing a compatible but
separately-computed result, with no single component responsible for the
full concept (state + duration + confidence + health) together.

## Target architecture

```
GPS Tracker
      │
      ▼
Traccar
      │
      ▼
Telemetry Ingestion
      │
      ▼
VehicleStateEngine
      │
      ▼
activityStateService
      │
      ▼
vehicle_activity_state
```

**Status (2026-07-16):** every box is built and genuinely wired. Telemetry
Ingestion exists as `vehicleEngine/activity/telemetryIngestion.js`
(Traccar `event.forward` webhook → `processTelemetryEvent`) plus
`jobs/telemetryReconciliationScheduler.js` (event-cursor recovery fallback)
and `jobs/vehicleStateReconciliationScheduler.js` (per-vehicle self-healing
sweep, catches what an event-cursor scan structurally cannot — a vehicle
that's gone silent). `VehicleStateEngine` → `activityStateService` →
`vehicle_activity_state` are implemented and, as of this update, actually
delegated to by every real caller (`activity/vehicleStateEngine.js` is now a
thin adapter over this engine, not a separate duplicate implementation —
see "Current callers" below for the full, accurate picture, including which
earlier claims in this doc turned out to be aspirational rather than real).

Responsibilities, top to bottom:

- **Traccar** remains the telemetry authority. It owns device connectivity,
  raw position/event ingestion from GPS hardware, and its own `tc_devices`/
  `tc_positions`/`tc_events` tables. Nothing in this codebase reimplements or
  second-guesses what Traccar reports.
- **Telemetry Ingestion** (not yet built) receives new telemetry/events from
  Traccar and passes them to `VehicleStateEngine`. **It contains no business
  logic** — no classification, no comparison, no persistence decisions. Its
  only job is getting telemetry from "Traccar said something changed" to a
  call into the engine.
- **`VehicleStateEngine`** classifies state (`resolveActivityState()`,
  unchanged) and detects transitions (`evaluateStateTransition()`). It
  remains pure and deterministic — see "Transition detection and ownership"
  below for exactly what that guarantees and why.
- **`activityStateService`** persists the engine's output to
  `vehicle_activity_state`. It does not classify or compare state itself.
- **Business modules** (dashboard, map, fleet list, reports, etc.) consume
  vehicle state — via the frontend's `resolveLiveActivityState.js` reading
  live Traccar data directly, or backend-side via the persisted row/engine
  snapshot — but **never calculate it**. If a consumer finds itself writing
  `if (speed > 0) { ... }` or comparing two state strings, that logic belongs
  in the engine, not the consumer.

## Responsibilities

`VehicleStateEngine` owns two things, both under one roof:

1. **The current operational state of a vehicle** — `buildVehicleState()` (Phase 1).
2. **Whether that state has changed since the last time anyone looked** —
   `evaluateStateTransition()` (Phase 2). This is the only place in the
   codebase permitted to compare a previous state to a current one — see
   "Transition detection and ownership" below.

It does not own persistence, scheduling, or history — those remain exactly
as they were before either phase (see "Relationship with
vehicle_activity_state" below).

## Public API

Two functions, both from `index.js`:

```js
import { buildVehicleState, evaluateStateTransition } from '../state/index.js';

// Just the current state:
const liveSnapshot = buildVehicleState(telemetry, persistedState);

// Current state PLUS "did it just change?":
const { snapshot, transition, metadata } = await evaluateStateTransition(telemetry, previousState, options);
```

`index.js` exports **only** these two functions. `VehicleStateSnapshot.js`,
`VehicleHealthEvaluator.js`, and `DurationCalculator.js` are internal
implementation details — do not import them directly from outside
`vehicleEngine/state/`.

### `evaluateStateTransition(telemetry, previousState, { resolveTransitionTimestamp })`

Resolves the current state (via `resolveActivityState()`, unchanged) and
compares it to `previousState`. Returns:

```js
{
  snapshot,    // same shape as buildVehicleState()'s output
  transition,  // null, or a transition object (see below)
  metadata: { initialObservation: boolean },
}
```

- **No `previousState` at all** → `transition: null`,
  `metadata.initialObservation: true`. This is deliberately *not* modeled as
  a transition — there is nothing to compare against, so fabricating a
  transition with a `null` `previousState` would be inventing history that
  never happened. The snapshot still gets a real `enteredAt`/`durationSeconds`
  (resolved the same way a genuine transition's timestamp is).
- **`previousState.state === currentState`** → nothing changed.
  `transition: null`, `metadata.initialObservation: false`, and the snapshot
  reuses the existing record's `stateEnteredAt` byte-for-byte (no
  re-derivation).
- **`previousState.state !== currentState`** → a genuine transition:

```js
{
  vehicleId,
  previousState,      // the old state string, e.g. 'idle'
  currentState,        // the new state string, e.g. 'moving'
  transitionedAt,       // ISO string — when the transition is believed to have happened
  previousEnteredAt,    // ISO string | null — when the previous state began
  reason,                // 'speed_changed' | 'heartbeat_timeout' | 'heartbeat_resumed'
  confidence,            // 'observed' | 'reconstructed'
}
```

Reason codes are simple and deterministic, derived only from values
`resolveActivityState()` already produces (no invented signals — e.g.
ignition is not part of that classification, so it's not a reason here):
transitioning **into** `offline` → `heartbeat_timeout`; **out of**
`offline` → `heartbeat_resumed`; `moving` ↔ `idle` (both online) →
`speed_changed`.

`options.resolveTransitionTimestamp` is an optional injected async callback,
`({deviceId, state, deviceLastUpdate, now}) => Promise<{at, source}>`. See
"Transition detection and ownership" for why this is dependency-injected
rather than imported. Without it, the engine falls back to a trivial
`now()`/`'observed'` default.

### Inputs

**`telemetry`** (required, but every field is individually optional/nullable):

| Field | Type | Meaning |
|---|---|---|
| `vehicleId` | `string \| null` | Echoed onto the snapshot |
| `deviceId` | `number \| null` | Echoed onto the snapshot |
| `deviceStatus` | `string \| null` | Raw Traccar `device.status` |
| `deviceLastUpdate` | `string \| Date \| null` | Raw Traccar `device.lastUpdate` |
| `positionSpeed` | `number \| null` | Raw Traccar `position.speed` |
| `positionFixTime` | `string \| Date \| null` | Raw Traccar `position.fixTime` — used only for health, not state classification |
| `now` | `number` | Evaluation timestamp, defaults to `Date.now()` — pass explicitly in tests |

**`persistedState`** (optional): the existing `vehicle_activity_state` row
for this vehicle, if the caller has one on hand — `{ state, stateEnteredAt,
stateSource }`. Omit for a pure live evaluation (duration and confidence
will both come back as unavailable/`'unknown'`).

### Output — the snapshot

```js
{
  vehicleId,          // string | null
  deviceId,           // number | null
  state,              // 'moving' | 'idle' | 'offline' — from resolveActivityState(), unchanged
  enteredAt,          // ISO string | null
  durationSeconds,    // number | null
  confidence,         // 'observed' | 'reconstructed' | 'unknown'
  health,             // 'ok' | 'warning'
  issues,             // string[] — e.g. ['stale_telemetry']
  telemetry,          // the normalized telemetry subset used for this evaluation
}
```

## How each field is populated

- **`state`** — calls `resolveActivityState()` from
  `vehicleEngine/activity/resolveActivityState.js` directly, unmodified. This
  is still the one canonical algorithm; the engine adds nothing to it and
  must never reimplement it.
- **`enteredAt` / `durationSeconds`** — `DurationCalculator.calculateDuration()`.
  Only trusts `persistedState.stateEnteredAt` when
  `persistedState.state === state` (the live-resolved state). If they
  disagree, both come back `null` — the persisted record is either about to
  be corrected or already stale/latched (see the known persistence defect
  below), and showing a duration in that case would be showing a wrong
  number with confidence. This is the same agreement-gating rule already
  shipped on the frontend (`resolveLiveActivityState.js` consumers).
- **`confidence`** — `'observed'` or `'reconstructed'`, passed through from
  `persistedState.stateSource` **only when the states agree**; otherwise
  `'unknown'`. Not computed independently — the engine has no way to know
  *how* a duration was originally derived, only whether the record it has is
  still trustworthy.
- **`health` / `issues`** — `VehicleHealthEvaluator.evaluateVehicleHealth()`.
  Conservative, narrow checks only:
  - `stale_telemetry`: online/idle/moving state but `positionFixTime` older
    than 25 minutes (mirrors the frontend's `STALE_FIX_MS`, kept in sync
    intentionally rather than re-derived).
  - `telemetry_conflict`: state resolved to `offline` but the last known
    `positionSpeed` was positive.
  - `excessive_offline_duration` is **not implemented** — left as a
    documented TODO in `VehicleHealthEvaluator.js`. No threshold for
    "excessive" exists anywhere in the codebase; inventing one was out of
    scope for this refactor.

## Transition detection and ownership

Before Phase 2, the comparison `existing.state === state` lived inline
inside `activityStateService.js`'s `evaluateAndPersistActivityStates()` —
the only place in the codebase that compared a previous state to a current
one, and it lived outside the engine. That comparison now lives exclusively
in `evaluateStateTransition()`. **No other file may reimplement it.** If a
future caller needs to know "did this vehicle's state change," it calls this
function — it does not read two state values and compare them itself.

The engine still imports nothing beyond `resolveActivityState()` — no
Sequelize, no Traccar MySQL access, no `fetchActivityEvidence`. The one
genuinely I/O-dependent part of transition detection — resolving *when* a
transition into `moving`/`idle` actually happened, which requires a
`tc_events` lookback query — is handled entirely by an **injected callback**
(`resolveTransitionTimestamp`), not an import. The caller
(`activityStateService.js`) owns the real implementation
(`resolveStateEnteredAt`, unchanged, kept private to that file) and passes
it in as a plain function reference. This keeps the dependency edge strictly
one-directional — `activityStateService.js` imports the engine, the engine
never imports anything that could import it back — and keeps every
transition scenario (idle→moving, moving→offline, first observation,
reconstructed timestamps, etc.) a fast, pure `node:test` unit test with zero
database involved. Verified end-to-end against real dev data too: a
synthetic stale persisted row (`moving`) was forced onto a real vehicle,
`evaluateAndPersistActivityStates` correctly detected the disagreement with
live Traccar telemetry, invoked the injected reconstruction callback, and
persisted the correct `offline` state with the correct reconstructed
timestamp — then the row was restored.

## Relationship with Traccar

The engine never talks to Traccar directly. Callers are responsible for
fetching device/position rows (from Traccar's MySQL, via the existing
`getTraccarDevicesByIds`/`getTraccarLatestPositionsByDeviceIds` helpers
already used by `vehicleFleetService.js`) and passing the relevant fields in
as `telemetry`. This keeps the engine a pure function over its inputs —
trivial to unit test, no I/O, no side effects.

## Relationship with `vehicle_activity_state`

**Schema and write mechanics unchanged.** This refactor does not touch:

- The table schema.
- `batchUpsert()` (the actual `INSERT .. ON CONFLICT` in
  `activityStateService.js`) — unchanged.
- `resolveStateEnteredAt()` — unchanged implementation, still private to
  `activityStateService.js`, still does the `tc_events`-based reconstruction
  lookback for `moving`/`idle` transitions. **Now invoked as the injected
  `resolveTransitionTimestamp` callback** rather than called inline — see
  "Transition detection and ownership" above.
- The known, previously-identified persistence defect: because
  `vehicle_activity_state` is only ever re-evaluated when a request happens
  to arrive (`listVehiclesMerged`/`getVehicleMerged`, both `requireManager`
  and request-triggered, no scheduler), an entire moving↔idle↔moving
  round-trip between two widely-spaced evaluations can go undetected —
  **not fixed by this change**. `DurationCalculator`'s agreement-gating
  (Phase 1) and now `evaluateStateTransition`'s explicit comparison
  (Phase 2) are both read/detection-time safeguards, not a fix to *how
  often* the write path actually runs. That's exactly the gap Telemetry
  Ingestion (see "Target architecture" and "Future direction" below) is
  meant to close — preferably by reacting to Traccar's own events as they
  happen, with polling/reconciliation only as a fallback, not the primary
  path.

What changed: the **comparison itself** (`existing.state === state`) no
longer lives in `activityStateService.js` — it's been moved into
`evaluateStateTransition()`. `activityStateService.js` is now a thin
adapter: load the previous row, ask the engine what to do with it, persist
the result. See "Current callers" below.

## Current callers

**Correction (2026-07-16):** an earlier version of this document claimed
`activityStateService.js` and `telemetryHub.js` were already refactored to
call this engine. That was aspirational, not accurate — the engine
(`VehicleStateEngine.js`, `DurationCalculator.js`, `VehicleHealthEvaluator.js`,
tests) was written and validated in isolation but never actually wired into
the live code; `activity/vehicleStateEngine.js` kept its own separate,
duplicate inline implementation of the same comparison logic. That wiring is
now genuinely done, as part of the self-healing work below.

| Caller | Status |
|---|---|
| `vehicleEngine/activity/vehicleStateEngine.js` (`evaluateStateTransition`) | **Genuinely wired.** Now a thin adapter: delegates classification/comparison to this engine's `evaluateStateTransition()`, injecting its own private `resolveStateEnteredAt()` as the `resolveTransitionTimestamp` callback, and adapts the `{snapshot, transition, metadata}` result back to the flat `{state, stateEnteredAt, stateSource, changed, issues}` shape its own two callers already expect. External contract preserved (existing callers needed no changes beyond an additive `issues` field). Adds an optional `forceRebuild` flag used by `evaluateAndHeal()` below. |
| `vehicleEngine/activity/activityStateService.js` (`evaluateAndPersistActivityStates`) | Calls `evaluateAndHeal()` (not the engine directly) per vehicle, `source: 'on_demand'`. Persists as before; additionally records a `vehicle_state_audit_events` row when the result is a genuine correction (see "Self-healing and audit" below). |
| `vehicleEngine/activity/telemetryIngestion.js` (`processTelemetryEvent`, the webhook path) | Same: calls `evaluateAndHeal()`, `source: 'webhook'`. |
| `jobs/vehicleStateReconciliationScheduler.js` (new) | Calls `evaluateAndHeal()` per vehicle under its own advisory lock, `source: 'reconciliation'` or `'startup'`. See below. |
| `vehicleEngine/hub/telemetryHub.js` | **Still calls `resolveActivityState()` directly**, not `buildVehicleState()`. Never actually migrated despite the original claim. Out of scope for the self-healing work — flagged here so a future session doesn't assume it's done. |

**Deliberately not refactored** (documented decision, not an oversight):

- `services/fleetCommandCenterService.js` and `services/fleetSummaryService.js`
  — both run `resolveActivityState()` over a bulk row-set purely to produce
  an online **count**, with no per-vehicle identity (no `vehicleId` in scope
  at that point in the query). Building a full snapshot per row for a
  boolean count would add allocation overhead for no behavioral benefit.

## Self-healing and audit

The engine's persisted output was always correct *when something asked for
it* (a webhook event, a page load) — the gap was that nothing ever
proactively re-verified a vehicle whose row simply sat there unread, and no
correction left a trace. Three additions close that:

**`vehicleEngine/activity/evaluateAndHeal.js`** — the single shared
orchestration every call site uses instead of calling `evaluateStateTransition`
directly. It:
1. Evaluates normally first.
2. If unchanged, but `buildVehicleState()`'s health check reports an issue
   that specifically implies the *timestamp itself* is wrong (currently
   `state_contradicted_by_recent_telemetry` or `excessive_reconstructed_duration`
   — **not** `stale_telemetry`/`telemetry_conflict`, which are informational
   telemetry-quality context, not evidence the stored value is incorrect —
   forcing a repair on those would just re-stamp the same value every tick),
   re-evaluates with `forceRebuild: true`.
3. A forced repair only counts as an actual correction if it produced a
   genuinely different state or timestamp — never a no-op write/audit row.
4. Anything the reconciliation/startup sweep has to fix is a correction by
   definition (normal live traffic missed it). Routine transitions via the
   webhook or an on-demand read are not — those stay covered by the existing
   `telemetry.ingest.processed` log line and `VEHICLE_STATE_CHANGED` event.

**`vehicle_state_audit_events`** table (migration `20260716_vehicle_state_audit_events.sql`,
model `VehicleStateAuditEvent`) — one row per genuine correction: vehicle id,
previous/corrected state, previous/corrected `stateEnteredAt`, a `reason`
(the triggering issue code, or `transition_detected_during_sweep` /
`first_observation_during_sweep`), and `source`. Written via
`vehicleStateAuditService.recordVehicleStateCorrection()` — best-effort,
never throws, so an audit-write failure can't block the actual repair.

**`jobs/vehicleStateReconciliationScheduler.js`** — genuinely iterates every
vehicle with an active device assignment (not an event-cursor scan like
`telemetryReconciliationScheduler.js`, which can never catch a vehicle
that's gone silent with zero new `tc_events`). Runs on an interval
(`VEHICLE_STATE_RECONCILE_INTERVAL_MS`, default 15 minutes) and once eagerly
on every server boot (`runVehicleStateStartupReconcile()`, mirroring
`runImmobilizationStartupReconcile()`) — so a crash, a bad deploy, or a
future bug can't leave a vehicle showing a stale duration indefinitely; the
next boot or the next tick catches it automatically.

## Other extension points

- `transition`/`metadata` are surfaced to `evaluateAndHeal()` (which reads
  `issues` off the snapshot) but not beyond that — no notification/event-bus
  consumer yet. Still an open extension point.
- API responses (`GET /api/vehicle-engine/:id`, `GET /api/vehicles`) still do
  **not** expose the richer snapshot (`durationSeconds`, `confidence`,
  `health`, `issues`) to clients. Still an explicit future decision, not
  taken by the self-healing work.
- `telemetryHub.js` migrating to `buildVehicleState()` (see "Current
  callers" above) remains unstarted.
