# Vehicle Odometer — Milestone 3 Implementation Guide



**Authority:** [VEHICLE_ODOMETER_STANDARD.md](VEHICLE_ODOMETER_STANDARD.md) (M1 business) · [VEHICLE_ODOMETER_ENGINE_SPEC.md](VEHICLE_ODOMETER_ENGINE_SPEC.md) (M2 engine)



This document maps M3 code, APIs, and migration status. See [VEHICLE_ODOMETER_MIGRATION_REPORT.md](VEHICLE_ODOMETER_MIGRATION_REPORT.md) for completion details.



---



## Single live odometer



| Surface | Field / function |

|---------|------------------|

| Vehicle Engine read | `GET /api/vehicles/:id/engine` → `registry.odometerKm` |

| Direct odometer read | `GET /api/vehicles/:id/odometer` |

| Resolution | `fuel-api/src/vehicleEngine/odometer/resolveVehicleOdometer.js` |



No module should compute parallel mileage. `hub.telemetry` exposes raw distance evidence only (`evidence.rawDistanceM`), not odometer semantics.



---



## Package layout



```

fuel-api/src/vehicleEngine/odometer/

├── collectEvidence.js      # Traccar + the vehicle's anchor (vehicle_odometer_anchors)

├── normaliseEvidence.js    # Attribute priority, unit normalisation

├── validateEvidence.js     # Stale / reset suspicion

├── resolveOdometer.js      # Anchored / telemetry_only / unavailable

├── scoreConfidence.js      # High / medium / low / unavailable

├── calculateDrift.js       # Drift vs latest Observation

├── formatOdometerResponse.js  # Shared API/registry field serializer

├── resolveVehicleOdometer.js

├── vehicleOdometerAnchorService.js  # Vehicle-owned anchor: observations + history (replaces applyObservation.js)

├── odometer.test.js

└── odometer.integration.test.js

```



Wiring:



- `vehicleEngineService.js` — calls resolver before `buildRegistry`

- `registryBuilder.js` — `odometerKm`, `odometerConfidence`, `odometerDriftPct`, `odometerDriftClass`

- `operationSessionCore.js` — enriches refuel DTOs with live `odometerKm` at read time



---



## Writes



| Type | Path | Storage |

|------|------|---------|

| **Observation** (human-confirmed) | `POST /api/vehicles/:id/odometer/observation` `{ odometerKm, source, confirmedPhysical?, reason? }` | `vehicle_odometer_anchors` (append-only, per vehicle; see [VEHICLE_OWNED_ODOMETER.md](VEHICLE_OWNED_ODOMETER.md)) |

| **Snapshot** (system capture at fuel event) | Fuel prefill / refuel complete | `operation_session_refuels.currentMileage`, `mileageSource: snapshot` |



Service completion with explicit `odometerKm` calls `applyServiceCompletionOdometer` (same plausibility rules as any observation) via `serviceRecordService.js`. `applyObservation.js` was removed; `vehicle_specs.verifiedOdometer*` is now only a rollback-safety mirror.



---



## Consumers migrated



| Area | Change |

|------|--------|

| Fuel prefill | `operationSessionCore.prepareInitialRefuelsForSession` → `resolveOdometerForDevice` |

| Fuel Day read UI | Refuel DTO `odometerKm` (engine-enriched) |

| Maintenance due | `maintenanceTraccarAdapter` → engine metres fallback for `computeDue` |

| Refuel telemetry | `refuelTelemetryService` — tank level + raw attrs only (no public mileage) |

| Frontend Hero / maintenance / setup | `registry.odometerKm` + observation API |

| Fuel hub | `liveOdometerKm` from engine |



Removed: `odometerService.js`, deprecated device-scoped odometer routes, frontend `mileage.js`, `computeOdometerFromBaseline`.



---



## Engine response (additive)



```json

{

  "registry": {

    "odometerKm": 221450,

    "odometerConfidence": "high",

    "odometerDriftPct": 0.05,

    "odometerDriftClass": "excellent"

  },

  "hub": {

    "telemetry": {

      "evidence": { "rawDistanceM": 221450000, "lastFixAt": "..." }

    }

  }

}

```



Without an Observation, `odometerDriftPct` is `null` and `odometerDriftClass` is `unknown`.



---



## Frontend API helpers



`traccar-fleet-system/frontend/src/fleet/vehiclesApi.js`:



- `fetchVehicleOdometerState(user, fleetVehicleId)`

- `recordOdometerObservation(user, fleetVehicleId, { odometerKm, source })`



Setup UI: `VehicleOdometerObservation.jsx`



---



## v1.1 (optional)



~~Immutable `odometer_observations` append-only table for audit trail.~~ **Superseded (2026-10):** `vehicle_odometer_anchors` is that append-only audit trail and is owned by the vehicle — see [VEHICLE_OWNED_ODOMETER.md](VEHICLE_OWNED_ODOMETER.md).



---



## Verification checklist



- [x] Hero odometer = engine `registry.odometerKm` = fuel prefill source

- [x] Maintenance distance schedules use engine km (metres at Traccar bridge)

- [x] Drift null/unknown without Observation; bands after manual observation

- [x] Legacy spec routes removed

- [x] `node --test` on `odometer.test.js` and `odometer.integration.test.js` (23/23 pass in backend container)


## Daily Mileage (activated 2026-07-21)

Distance travelled per vehicle per Africa/Lusaka business day, shown on MapView vehicle cards
(`Daily Mileage • xx.x km`; sidebar rows show `Today xx.x km`; falls back to the labeled
odometer when the day has no data — never a fabricated 0).

| Piece | Location |
|-------|----------|
| Ledger table | `vehicle_daily_mileage` (`20260704_vehicle_daily_mileage.sql`), unique on (vehicleId, localDate) |
| Writer | `fuel-api/src/vehicleEngine/mileage/dailyMileageService.js` — idempotent upsert; day-start baseline reconstructed from Traccar position history (`dayStartEvidence.js`); rows past a 48 h grace window freeze |
| Scheduler | `fuel-api/src/jobs/dailyMileageScheduler.js` — sweeps actively assigned vehicles, then settles finished days (below); env `DAILY_MILEAGE_INTERVAL_MS` (default 300000, 0 disables), `DAILY_MILEAGE_STARTUP_DELAY_MS` (default 20000) |
| Read model | `dailyMileageReadModel.js` — attached as `dailyMileage` on merged vehicle rows (`GET /api/vehicles`, one batched query; no N+1) |
| Frontend | display registry → `vehicleTodayDistance.js` → `VehicleContextCard` / `VehicleListItem` |

**Distance semantics:** the ledger diffs **unit-corrected raw telemetry** (`telemetryKm` exposed by
`resolveOdometerFromEvidence`), not the anchored `odometerKm` — the M2 §7 anchored mode clamps
readings below the anchor point, which would flatten any day at/before an anchor capture to zero.
Anchored values remain the display truth for absolute odometer readings. The API DTO serves
`max(live anchored diff, ledger telemetry diff)`: the live diff can only undercount (clamp), and the
ledger is at most one sweep stale, so the larger value is always closest to truth. `km: null` means
"unknown" (e.g. tracker offline all day), never zero.

**Finished days are settled (2026-10).** The 5-minute sweep only ever computes *today*, so a day's
row used to be left at whatever the last sweep before midnight saw. Now, once a day has ended, any
existing row for it that was last computed before its latest *settle point* is recomputed against
that day's own end boundary (never today's live odometer):

| Settle point | Why |
|--------------|-----|
| day end + 3 h | final figure shortly after midnight, once in-flight positions have arrived |
| day end + 27 h | catches positions a tracker buffered while offline and uploaded the next day |

Only yesterday and the day before are considered, so every recompute falls inside the 48 h grace
window after which a resolved row freezes. Only **existing** rows of vehicles whose **current device
was already assigned when that day began** are touched: a recompute reads the current assignment's
history, so a swapped tracker would otherwise overwrite a good historical row with another device's
numbers. Sweep stats now report `settled` / `settleFailed`; a settle failure never stops the live
sweep. Days older than the grace window, or with no row at all, are not backfilled.

A real measurement is never replaced by "unknown", for any day including today: if a recompute finds no
history (tracker unassigned since, Traccar returning nothing, a counter glitch) and the stored row already
has a `distanceKm`, the stored row is kept untouched. A recompute that does resolve replaces it, which is how
today's figure keeps growing. A kept finished-day row stays "unsettled" and is retried each sweep until it
leaves the two-day window.

**Unknown, not negative.** A negative day-end-minus-day-start difference (counter reset, or Traccar
positions arriving out of order around a boundary) is stored as `distanceKm = NULL`, not as a
negative or zero distance.

**Partial days.** If the tracker had no fix before midnight, the day-start baseline is the first fix
*after* it (`dayStartSource = 'nearest_after'`), so anything driven before that fix is not counted.
The figure is real but covers only part of the day, and the card labels it
`Daily Mileage • xx.x km (partial day)`. `exact_boundary` (a fix within 2 min of midnight) and
`nearest_before` carry no caveat.

**Traccar `totalDistance` caveat.** Traccar accumulates it in *arrival* order, so it is not
monotonic in fix-time order when positions arrive late. Differences across a boundary that late
positions straddle can come out wrong (hence the negative-to-null rule above); they are not
corrected, only never presented as a distance.

### Confidence and staleness (2026-10)

Telemetry freshness is graded rather than a single flag (`validateTelemetryFreshness`). The
diagnostics are cumulative and each subtracts from the confidence score:

| Diagnostic | Silent for | Score |
|------------|-----------|-------|
| `stale_telemetry` | > 5 min and not online | −15 |
| `stale_telemetry_day` | ≥ 24 h | additional −15 |
| `stale_telemetry_week` | ≥ 7 d, or no telemetry timestamp at all | additional −25 |

Consequences, for an anchored estimate with no drift: High while the tracker is reporting (and up to
a day quiet), Medium from 24 h, Low from 7 d. The odometer *value* is never altered by staleness, only its confidence, which in turn
gates fuel-efficiency intervals (`low` / `unavailable` intervals are stored but not learned from).

Freshness comes from the telemetry itself. `getTraccarPosition` now also returns the device's
`status` / `lastupdate`, `getVehicleTelemetry` exposes them, and `collectEvidence` fills the
`device` / `position` freshness from them when the caller supplied none (previously the single-device
resolution path had no freshness input and always scored as stale). Historical day-start
reconstruction judges each fix **as of its own time** (`device.lastUpdate = fix time`): measuring a
past fix's age against today's clock would mark every historical day stale.

### Maintenance mileage (2026-10)

Service reminders use **the same mileage as everything else**: the canonical odometer.

- A distance schedule (`totalDistance`, which includes Routine Service) is measured against the Vehicle
  Odometer Engine's `odometerKm` and nothing else: `computeDue(schedule, position, odometerMeters)` in
  `maintenance/maintenanceDueEngine.js`. The raw tracker counter on the position is **not read** for
  distance schedules. It is on a different scale from a schedule's `start` (a tracker can count more or
  less than the real odometer), and the previous `max(raw counter, odometer)` rule meant a downward
  odometer correction could never lower maintenance mileage. With no canonical odometer the schedule is
  `unknown` ("Awaiting telemetry") instead of guessed. Schedules on other attributes (`hours`, ...) still
  read their own attribute; time schedules are unchanged.
- **One remaining-km calculation.** `routineRemainingKm(item)` over the due engine's `remaining` feeds the
  maintenance dashboard, the notification/fleet-list summary and the vehicle page's *Next service*. The
  vehicle engine no longer subtracts its own registry odometer from `nextDue`.
- **One odometer per response.** Callers that have already resolved the odometer pass it in, and the
  loaders resolve only what was not supplied: the fleet list (`odometerKmByDevice`), the vehicle record and
  the vehicle engine (`odometerKm`). A supplied `null` means "unknown" and is honoured. The maintenance
  dashboard and notification scheduler resolve per device through the same engine.

**Behaviour change to expect on deploy.** For a vehicle whose tracker counter runs *ahead* of its verified
odometer (`verifiedTraccarDistance / 1000 > verifiedOdometerKm`), the dashboard and notifications used to
show fewer km remaining than the vehicle page, by exactly that offset; they now show the same, larger,
figure, so a service previously flagged *due soon* or *overdue* there may no longer be. Vehicles whose
tracker counter is behind the odometer (the usual case) are unchanged. To list affected vehicles:

```sql
SELECT "deviceId", "verifiedOdometerKm", "verifiedTraccarDistance" / 1000 AS tracker_km
FROM vehicle_specs
WHERE "verifiedOdometerKm" IS NOT NULL AND "verifiedTraccarDistance" / 1000 > "verifiedOdometerKm";
```

Done in later stages (see [VEHICLE_OWNED_ODOMETER.md](VEHICLE_OWNED_ODOMETER.md)): the odometer anchor now belongs to the vehicle, not the tracker. Still not changed: the Traccar-side `start` of a schedule is still written in odometer metres.

### Vehicle-owned odometer and accepted mileage (2026-10)

Mileage now belongs to the vehicle, tracker readings are filtered through acceptance rules before they can move it,
and the daily ledger is built from the same accepted evidence. The full rules (observation plausibility, accepted
readings, tracker replacement, reconciliation, migration/rollback, recovery, limitations) are in
[VEHICLE_OWNED_ODOMETER.md](VEHICLE_OWNED_ODOMETER.md). The resolver in this guide is unchanged in role: it is still the
one mileage authority; it now reads the vehicle's anchor and the accepted counter instead of a tracker-keyed anchor and the
raw counter.
