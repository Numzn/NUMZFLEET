# Vehicle Feature

## When to use

- Implementing or changing vehicle intelligence, capabilities, odometer, health, or hub aggregation.
- Adding vehicle-scoped API behavior in fuel-api.
- Ensuring modules don't duplicate vehicle calculations.

## Governance (read first)

[fuel-api/src/vehicleEngine/CONTRACT.md](../../../fuel-api/src/vehicleEngine/CONTRACT.md) — authoritative.

### Core rules

1. **One read model:** `GET /api/vehicles/:id/engine`
2. **Modules ask the engine** for intelligence — no parallel KPI/health/due-date endpoints.
3. **Engine owns calculations** (health, urgency, fuel delta, cost rollups).
4. **Modules own writes** (fuel, maintenance, trips, documents, compliance).
5. **Engine is not CRUD** — aggregation layer only.
6. **Intelligence builder** consumes engine state only.

## Key paths

| Layer | Location |
|-------|----------|
| Service | `fuel-api/src/vehicleEngine/vehicleEngineService.js` |
| Hubs | `fuel-api/src/vehicleEngine/hub/` (`telemetryHub`, `fuelHub`, …) |
| Capabilities | `fuel-api/src/vehicleEngine/capabilitiesBuilder.js` |
| Odometer | `fuel-api/src/vehicleEngine/odometer/` |
| Fleet CRUD | `fuel-api/src/services/vehicleFleetService.js` |
| Models | `fuel-api/src/models/Vehicle.js`, `VehicleSpec.js` |

## Odometer

Frozen specs in `docs/VEHICLE_ODOMETER_*.md`. Live mileage resolves through the Vehicle Odometer Engine — do not add parallel frontend/backend calculators.

## Implementation checklist

- [ ] Writes go to the owning module's service/model
- [ ] Reads for dashboards use engine endpoint or engine-enriched DTOs
- [ ] `company_id` scoping on all tenant data
- [ ] Capabilities are booleans from registry + hub facts
- [ ] Tests in `fuel-api/src/vehicleEngine/*.test.js` for engine logic

## Frontend consumption

Use `useVehicleEngine` hook (`traccar-fleet-system/frontend/src/fleet/vehicleDetail/hooks/useVehicleEngine.js`) — do not recompute health/due dates in UI.

Navigation stays on `/fleet/vehicles/…` — `deviceId` is internal wiring for sockets/live map.
