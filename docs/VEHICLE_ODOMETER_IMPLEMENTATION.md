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

