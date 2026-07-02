# Vehicle Odometer — Migration Report

**Date:** 2026-07-01  
**Scope:** Complete Vehicle Odometer Engine (M3) — verification and legacy removal  
**Architecture:** Unchanged — single live odometer via Vehicle Odometer Engine

---

## Summary

The Vehicle Odometer Engine is now the sole resolver of live mileage. Legacy parallel calculators, deprecated device-scoped API routes, and frontend telemetry resolvers have been removed. Read paths enrich DTOs with live `odometerKm` from the engine; write paths are restricted to Observation and Snapshot owners.

---

## Files modified

### Backend (`fuel-api/`)

| File | Change |
|------|--------|
| `src/vehicleEngine/odometer/calculateDrift.js` | Drift without observation → `null` / `unknown` |
| `src/vehicleEngine/odometer/resolveOdometer.js` | Removed `computeOdometerFromBaseline` |
| `src/vehicleEngine/odometer/resolveVehicleOdometer.js` | Unavailable state drift defaults |
| `src/vehicleEngine/odometer/formatOdometerResponse.js` | **New** — shared API/registry serializer |
| `src/vehicleEngine/odometer/odometer.test.js` | Updated drift contract tests |
| `src/vehicleEngine/odometer/odometer.integration.test.js` | **New** — integration coverage |
| `src/vehicleEngine/registryBuilder.js` | Default drift `null` / `unknown` |
| `src/controllers/vehicleOdometerController.js` | Uses `formatOdometerResponse` |
| `src/controllers/vehicleSpecController.js` | Removed legacy odometer handlers; blocks `verifiedOdometerKm` on spec update |
| `src/routes/vehicleSpecs.js` | Removed deprecated odometer routes |
| `src/services/operationSessionCore.js` | Batched DTO enrichment; `toRefuelDtos` / `toRefuelDtoEnriched` |
| `src/services/operationSessionService.js` | Uses `toRefuelDtos`; snapshot writes only on fuel-complete bulk path |
| `src/services/operationRefuelRecordService.js` | Returns enriched refuel DTOs |
| `src/services/vehicleFuelStatisticsService.js` | Exposes `liveOdometerKm` |
| `src/services/operationReportingService.js` | Live `odometerKm` on vehicle KPI refuel rows |

### Frontend (`traccar-fleet-system/frontend/`)

| File | Change |
|------|--------|
| `src/fleet/vehiclesApi.js` | Removed deprecated `fetchVehicleOdometer` / `verifyVehicleOdometer` |
| `src/fleet/vehicleDetail/setup/modules/VehicleOdometerObservation.jsx` | **Renamed from** `VehicleVerifiedOdometer.jsx` |
| `src/fleet/vehicleDetail/setup/modules/FuelSetupModule.jsx` | Updated import |
| `src/fleet/vehicleDetail/CompleteMaintenanceDialog.jsx` | Engine-only odometer prefill (no Traccar fallback) |
| `src/operationSessions/components/PendingRefuelCard.jsx` | Prefill/display from `refuel.odometerKm` |
| `src/operationSessions/components/CompletedRefuelCard.jsx` | Display `refuel.odometerKm` |
| `src/operationSessions/components/OperationVehicleRow.jsx` | Display `refuel.odometerKm` |
| `src/fleet/vehicleDetail/VehicleFuelColumn.jsx` | Live odometer for “at X km” |
| `src/fleet/vehicleDetail/VehicleWorkspaceTabs.jsx` | Passes `odometerKm` to fuel column |

### Docs

| File | Change |
|------|--------|
| `docs/VEHICLE_ODOMETER_IMPLEMENTATION.md` | Checklist updated |
| `docs/VEHICLE_ODOMETER_MIGRATION_REPORT.md` | This report |

---

## Files deleted

| File | Reason |
|------|--------|
| `fuel-api/src/services/odometerService.test.js` | Legacy baseline tests superseded by engine tests |
| `traccar-fleet-system/frontend/.../VehicleVerifiedOdometer.jsx` | Renamed to `VehicleOdometerObservation.jsx` |

---

## Legacy code removed

- `computeOdometerFromBaseline()` in `resolveOdometer.js`
- `legacyOdometerPayload`, `getOdometer`, `verifyOdometer` in `vehicleSpecController.js`
- Routes `GET /api/vehicle-specs/:deviceId/odometer` and `POST .../verify-odometer`
- Frontend `fetchVehicleOdometer`, `verifyVehicleOdometer`
- Traccar maintenance accumulator fallback in `CompleteMaintenanceDialog`

---

## Deprecated routes remaining

**None.** All device-scoped odometer proxy routes were removed (no active callers found).

---

## Consumer migration (final status)

| Consumer | Previous source | New source | Status |
|----------|-----------------|------------|--------|
| Workspace Hero | Mixed | `registry.odometerKm` | Done |
| Vehicle Overview | — | engine registry | Done |
| Maintenance tab / complete dialog | Traccar fallback | `registry.odometerKm` only | Done |
| Odometer setup UI | verify-odometer API | `fetchVehicleOdometerState` | Done |
| Fuel Day prefill (backend) | telemetry | `resolveOdometerForDevice` | Done |
| Fuel Day UI (pending/complete/row) | `currentMileage` snapshot | DTO `odometerKm` (live) | Done |
| Fuel column “at X km” | snapshot | live `odometerKm` | Done |
| Maintenance due engine | raw totalDistance | engine fallback metres | Done |
| Fuel hub last refuel | snapshot mileage | `liveOdometerKm` | Done |
| Fuel efficiency stats | snapshot deltas (internal) | unchanged for km/L math | OK (not live odometer) |
| Reports trip distance | Traccar trips | unchanged (separate metric) | OK |
| Position popup totalDistance | raw telemetry | unchanged (evidence display) | OK |

**Display policy:** All live mileage labels use `registry.odometerKm` (or DTO-enriched `odometerKm`). Historical snapshots remain stored in `currentMileage` for audit and efficiency math but are not shown as live odometer.

---

## Write ownership (final)

| Type | Allowed writers | Storage |
|------|-----------------|---------|
| **Observation** | `POST /api/vehicles/:id/odometer/observation`, `serviceRecordService` on completion | `vehicle_specs.verifiedOdometer*` |
| **Snapshot** | `prepareInitialRefuelsForSession` prefill, `operationRefuelRecordService`, fuel-complete bulk updates in `operationSessionService` | `operation_session_refuels.currentMileage` |

Blocked: `verifiedOdometerKm` on vehicle spec PUT; non-fuel-complete bulk session updates no longer write mileage.

---

## Verification checklist

| Check | Status |
|-------|--------|
| Hero odometer = engine `registry.odometerKm` = fuel prefill source | Pass (code path) — manual UI verify recommended |
| Maintenance distance schedules use engine km | Pass |
| Drift `null` / `unknown` without Observation; bands after observation | Pass |
| Legacy spec routes removed | Pass |
| `node --test` on `odometer.test.js` + `odometer.integration.test.js` | **Pass** (23/23 in backend container) |

---

## Remaining TODO items

1. **Manual UI verification** — confirm one linked vehicle shows identical km on Hero, Overview, Fuel Day, Maintenance, Setup (run `.\rebuild-stack.ps1` if stack needs refresh).
2. **v1.1 audit table** — optional append-only `odometer_observations` table (future).
3. **DB column rename** — `verifiedOdometer*` → `observation*` (future; internal only today).
4. **Run tests in CI/container:** `node --test src/vehicleEngine/odometer/*.test.js`

---

## API consistency

Both endpoints use `resolveVehicleOdometer` and `formatOdometerResponse`:

- `GET /api/vehicles/:id/engine` → `registry.odometerKm`, `odometerConfidence`, `odometerDriftPct`, `odometerDriftClass`
- `GET /api/vehicles/:id/odometer` → same four fields (flat JSON) + `resolutionMode`

Refuel session DTOs include `odometerKm` and `odometerConfidence` resolved at read time.
