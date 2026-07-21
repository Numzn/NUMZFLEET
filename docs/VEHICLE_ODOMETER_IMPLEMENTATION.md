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

├── collectEvidence.js      # Traccar + calibration anchor from vehicle_specs

├── normaliseEvidence.js    # Attribute priority, unit normalisation

├── validateEvidence.js     # Stale / reset suspicion

├── resolveOdometer.js      # Anchored / telemetry_only / unavailable

├── scoreConfidence.js      # High / medium / low / unavailable

├── calculateDrift.js       # Drift vs latest Observation

├── formatOdometerResponse.js  # Shared API/registry field serializer

├── resolveVehicleOdometer.js

├── applyObservation.js     # Writes calibration anchor (Observation)

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

| **Observation** (human-confirmed) | `POST /api/vehicles/:id/odometer/observation` `{ odometerKm, source }` | `vehicle_specs.verifiedOdometer*` (calibration anchor) |

| **Snapshot** (system capture at fuel event) | Fuel prefill / refuel complete | `operation_session_refuels.currentMileage`, `mileageSource: snapshot` |



Service completion with explicit `odometerKm` calls `applyObservation` via `serviceRecordService.js`.



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



Immutable `odometer_observations` append-only table for audit trail. v1 uses anchor columns on `vehicle_specs` only; no DB migration required for M3 launch.



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
| Scheduler | `fuel-api/src/jobs/dailyMileageScheduler.js` — sweeps actively assigned vehicles; env `DAILY_MILEAGE_INTERVAL_MS` (default 300000, 0 disables), `DAILY_MILEAGE_STARTUP_DELAY_MS` (default 20000) |
| Read model | `dailyMileageReadModel.js` — attached as `dailyMileage` on merged vehicle rows (`GET /api/vehicles`, one batched query; no N+1) |
| Frontend | display registry → `vehicleTodayDistance.js` → `VehicleContextCard` / `VehicleListItem` |

**Distance semantics:** the ledger diffs **unit-corrected raw telemetry** (`telemetryKm` exposed by
`resolveOdometerFromEvidence`), not the anchored `odometerKm` — the M2 §7 anchored mode clamps
readings below the anchor point, which would flatten any day at/before an anchor capture to zero.
Anchored values remain the display truth for absolute odometer readings. The API DTO serves
`max(live anchored diff, ledger telemetry diff)`: the live diff can only undercount (clamp), and the
ledger is at most one sweep stale, so the larger value is always closest to truth. `km: null` means
"unknown" (e.g. tracker offline all day), never zero.
