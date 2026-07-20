# Fleet UI Feature

## When to use

- Adding or changing fleet-facing React UI (vehicle workspace, registry, drivers, fuel tabs).
- Wiring frontend to fuel-api vehicle/engine endpoints.
- Feature flags and module visibility.

## Stack

- **Path:** `traccar-fleet-system/frontend/`
- **Dev:** `./scripts/dev` on NumzLab (hot reload) — not full rebuild for UI-only work.
- **Style:** ESLint Airbnb, functional components + hooks, 2-space indent, PascalCase components.

## Key directories

| Area | Path |
|------|------|
| Vehicle list | `src/fleet/VehiclesPage.jsx`, `vehicleRegistry/` |
| Vehicle workspace | `src/fleet/vehicleDetail/` |
| Setup modules | `src/fleet/vehicleDetail/setup/` |
| API client | `src/fleet/vehiclesApi.js` |
| Display registry | `src/fleet/display/` |
| Feature flags | `src/common/util/useFeatures.js` |

## Vehicle workspace tabs

Registry: `vehicleDetail/vehicleWorkspaceTabRegistry.js`

Tabs include overview, fuel, maintenance, setup, immobilizer, etc. Add new tabs via registry — avoid hardcoding routes in multiple places.

## Data hooks (prefer these)

| Hook | Purpose |
|------|---------|
| `useVehicleData` | Operational data + live position merge |
| `useVehicleEngine` | Authoritative engine intelligence |
| `useVehicleSetupForm` | Setup save flow |
| `useVehicleWorkspaceData` | Workspace tab data |

## API errors

Use `fuelApiErrorMessage()` for user-facing fuel-api failures.

## Feature flags

`useFeatures()` reads server/user attributes:

- `ui.disableVehicleFeatures` cascades to drivers/maintenance
- `numz.enableFuelRequests` on server attributes (defaults ON)

## Implementation checklist

- [ ] Vehicle-centric routes (`/fleet/vehicles/:id/…`)
- [ ] Engine read path for intelligence — no duplicate KPI math
- [ ] Telemetry via `normalizePositionTelemetry` in `telemetryUtils.js` (aligned with fuel-api)
- [ ] Match existing MUI patterns in sibling components
- [ ] No `console.log` left in PR

## Manual verify

Fleet UI on NumzLab: `http://fleet.numzlab` or `http://100.121.79.2:3003` (Tailscale).
