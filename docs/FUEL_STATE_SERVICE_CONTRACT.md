# Fuel State Service — Contract (Increment 3, shadow v0.1 IMPLEMENTED)

**Status:** Implemented in shadow mode — [`fuelStateService.js`](../fuel-api/src/vehicleEngine/fuel/fuelStateService.js).
Read-only projection, no schema, no DB writes. Not consumed by Fueling Day, Prediction Engine,
or Suggestion Engine.

## Purpose

`fuelStateService.js` produces a **modelled tank balance** (litres remaining) by replaying
refuel evidence since the last reliable full-tank anchor against authoritative odometer
movement — the first NUMZFLEET **Digital Fuel Twin**. It consumes Odometer Engine distance,
Fuel Learning maturity/envelope, and the approved efficiency hierarchy without duplicating any
of them.

## Two contract corrections vs the Increment 2 draft

1. **Availability ≠ maturity.** Projection availability is *not* gated on model maturity. A
   vehicle with a confirmed full anchor + authoritative odometer + tank capacity + spec
   efficiency projects even at `COLD_START` — provenance shows `efficiencySource: 'spec'`,
   `projectionQuality: 'limited'`. Maturity feeds quality, not availability.
2. **Ordered event replay is mandatory.** Aggregate arithmetic
   (`capacity − totalConsumption + Σpartials`) is rejected as the primary algorithm. The core
   (`replayFuelState`) walks events in deterministic order (`capturedAt` → `sessionDate`
   fallback → refuel-id tie-break), validating odometer progression per segment.

## Anchor rule (strict)

`isReliableFuelStateAnchor(refuel)` — exported, directly unit-tested:

- `isFullTank === true` (strict: `null`/`undefined`/`false` are never a confirmed full tank)
- `actualFuelLitres > 0`
- usable captured mileage (`currentMileage` finite and > 0 — prefill defaults 0 = not captured)
- `odometerConfidenceAtCapture` ∈ {high, medium} (same categorical semantics as
  `intervalValidator`)

No reliable anchor → `{ available: false, source: 'unavailable' }` with diagnostics.

## Fail-closed replay trust policy (v0.1)

`PARTIAL_EVENT_POLICY = 'fail_closed'`. The schema cannot distinguish "operator explicitly
selected partial" from "DB default false" (Increment 2 evidence audit: 8/11 `false` rows
suspiciously near tank capacity), so on live data **any refuel event after the anchor makes the
projection unavailable** rather than silently adding or skipping litres:

| Post-anchor event | Diagnostic |
|---|---|
| `isFullTank === false` | `untrusted_partial_after_anchor` |
| `isFullTank === true` but failed anchor predicate | `unreliable_full_event_after_anchor` |
| `null` / `undefined` | `ambiguous_fill_state` |
| any of the above | `replay_blocked_fail_closed` (policy marker) |

The replay core fully supports partial-add and full-tank recalibration (unit-tested); a future
`'explicit'` policy activates it once tri-state fill capture exists. Missing/unusable mileage
on any replayed fuel-changing event is an `ambiguous_replay_boundary` — hard stop, never a
quality warning. Backwards odometer (event or live) → `odometer_backwards`, no silent
correction.

## Inputs (existing functions only — verified signatures)

| Input | Source |
|-------|--------|
| Completed refuels | `findCompletedRefuelsByVehicleId(deviceId, REFUEL_PAIRING_LOOKBACK)` |
| Authoritative live odometer | `resolveOdometerForDevice(deviceId)`; the Vehicle Engine read path injects the registry's already-resolved odometer state so `fuelState.currentMileageKm` always equals `registry.odometerKm` |
| Efficiency | `resolveEfficiencySource({ hubFuel, learning, specEfficiency })` — learned → measured → spec → none; `none` → unavailable |
| Maturity | `loadFuelLearningState()` → `modelMaturity` (quality input only) |
| Tank capacity | `anchor.tankCapacitySnapshot` → `getVehicleSpec().tankCapacity` → unavailable (never a generic default); source recorded |

## Output (additive on `engine.fuel.fuelState`)

```javascript
fuelState: {
  available, modelledLitresRemaining, estimatedSpaceLitres,
  tankCapacityLitres, tankCapacitySource,          // 'anchor_snapshot' | 'vehicle_spec'
  anchorRefuelId, anchorAt, anchorMileageKm,
  currentMileageKm, distanceSinceAnchorKm,
  consumedLitresEstimate, partialLitresAdded,
  efficiencyKmL, efficiencySource, modelMaturity,
  projectionMode: 'shadow',
  projectionQuality,                                // 'limited' | 'moderate' | 'strong' | 'degraded'
  source,                                           // 'model' | 'unavailable'
  replayedRefuelCount, fullRecalibrationCount, ambiguousEventCount,
  calibrationOpportunities,                         // in-memory only, not persisted
  diagnostics: [{ code, ... }],
}
```

Public litres are clamped to `[0, capacity]`; raw excursions are preserved in diagnostics
(`raw_balance_below_zero` / `raw_balance_above_capacity`) — model disagreement is never hidden.
Telemetry `litresRemaining` / `tankLevelPct` / `tankLevelSource` are unchanged and remain the
parallel path.

## Projection quality (descriptive, no numeric confidence)

Derived from existing provenance categories only (`deriveProjectionQuality`):
replay anomalies / raw excursions / `SHIFT_SUSPECTED` / low live-odometer confidence →
`degraded`; learned + MATURE/RECALIBRATING → `strong`; measured or STABILIZING → `moderate`;
otherwise (spec, COLD_START/LEARNING) → `limited`.

## Calibration loop (calculated, not persisted)

At each replayed confirmed full-tank event:

```text
predictedLitresNeededToFull = capacity − predictedBalanceBeforeFill
calibrationErrorLitres      = predictedLitresNeededToFull − actualFuelLitres
```

(Never predicted-remaining vs fill litres — different quantities.) Exposed via
`calibrationOpportunities`; storage deferred until backtest validates usefulness.

## Validation tooling

`node src/scripts/shadowFuelStateReport.js --out ./shadow-output` — read-only fleet report:
availability, exact unavailable reasons, anchor, provenance, telemetry comparison, calibration
opportunities.

## Explicit non-goals (unchanged)

- No new DB tables or columns
- No Activity Engine trip distance
- No replacement of `PredictionEngine` or `SuggestionEngine`
- No Fueling Day workflow changes
- No Bayesian/Kalman/ML
- No silent reclassification of ambiguous `isFullTank=false` historical rows
- No invented numeric confidence percentages

## Increment 2 note

`ENVELOPE_GATING.enabled` is **false** for live learning (dev backtest 2026-07-05: 12 refuels,
0 learnable intervals — MAD parameters not fleet-tuned). Envelope computation, exposure,
simulation, and backtest support remain intact.
