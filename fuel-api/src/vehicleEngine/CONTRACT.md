# Vehicle Engine — Architecture & API Contract (v1)

## Principle

> **One authoritative vehicle state.** Modules contribute facts (writes); all UIs consume intelligence from a single read path. No module recalculates what the engine already knows.

The Vehicle Engine solves one problem:

> **Give every module one authoritative view of a vehicle.**

---

## Governance rules

Every contributor should read these before writing vehicle intelligence code.

### Rule 1

> Every vehicle has exactly one authoritative read model.

`GET /api/vehicles/:id/engine`

### Rule 2

> If a module needs vehicle intelligence, it asks the Vehicle Engine.

Do not add parallel KPI, health, or due-date endpoints for the same vehicle facts.

### Rule 3

> The Vehicle Engine owns business calculations.

Health, due status, urgency, fleet fuel delta, and cost rollups live in `engine/`. Modules and UI do not recompute them.

This also applies to document/compliance operational interpretation: modules write source records, and Vehicle Engine computes operational signals before intelligence.

### Rule 4

> Domain modules own writes.

- Fuel owns fuel transactions.
- Maintenance owns work orders and service records.
- Trips own trip records.
- Documents own document lifecycle and evidence records.
- Compliance owns compliance item records and due-date metadata.

The Vehicle Engine reads those records and produces a unified view. It does not own the write models.

### Rule 7

> Intelligence Builder consumes Vehicle Engine state only.

Do not call document/compliance services from `intelligenceBuilder.js`. If a new finding needs data, aggregate it in Vehicle Engine hub/engine layers first.

### Rule 5

> The Vehicle Engine never becomes a CRUD module.

It is an **aggregation and intelligence layer**, not another place to update vehicles.

### Rule 6

> New layers require evidence.

If someone proposes a new abstraction, answer:

1. What duplicated logic does it remove?
2. What real feature does it enable?

If neither has a good answer, don't add it.

---

## Seven responsibilities

Nothing more. The response has exactly these top-level layers (plus an `updatedAt` timestamp):

| # | Layer | Question |
|---|-------|----------|
| 1 | `registry` | What is this vehicle? (identity, spec, assignment) |
| 2 | `capabilities` | What can this vehicle support? (UI feature flags) |
| 3 | `hub` | What do we know right now? (facts, not opinions) |
| 4 | `engine` | What do those facts mean? (scores, KPIs, urgency) |
| 5 | `compliance` | Which obligations are due? (evaluated findings from hub compliance facts) |
| 6 | `intelligence` | What should we do? (findings + recommendations) |
| 7 | `timeline` | What has happened? (recent history) |

```text
Vehicle Engine
├── Registry
├── Capabilities
├── Hub
├── Engine
├── Compliance
├── Intelligence
└── Timeline
```

---

## Endpoint

`GET /api/vehicles/:id/engine`

- Auth: manager, tenant-scoped via `companyId`.
- Writes: none. After domain writes, clients reload this endpoint.

---

## Layer details

### Registry

Static identity from `getVehicleMerged`: id, name, plate, spec, assignment, device snapshot.

**Vehicle Odometer (M3):** `registry.odometerKm` is the sole live odometer for fleet UI and backend consumers. It is resolved only by `vehicleEngine/odometer/` (see [docs/VEHICLE_ODOMETER_STANDARD.md](../../../docs/VEHICLE_ODOMETER_STANDARD.md) and [docs/VEHICLE_ODOMETER_IMPLEMENTATION.md](../../../docs/VEHICLE_ODOMETER_IMPLEMENTATION.md)). Do not derive odometer from `hub.telemetry` or parallel services.

Additive registry fields:

```json
{
  "odometerKm": 221450,
  "odometerConfidence": "high",
  "odometerDriftPct": 0.05,
  "odometerDriftClass": "excellent"
}
```

Observations (human-confirmed dashboard readings) are written via `POST /api/vehicles/:id/odometer/observation`. Fuel refuel prefills store **Snapshots** in `currentMileage` only.

### Capabilities

Booleans derived from registry + hub — no capability framework.

```json
{
  "gps": true,
  "fuel": true,
  "maintenance": true,
  "temperatureSensor": false,
  "canBus": false
}
```

### Hub

Normalized facts: `telemetry`, `fuel`, `maintenance`, `repairs`, `activity`. No scores.

Raw compliance records are loaded via `hub/complianceHub.js` but are not exposed on `hub` — they feed the top-level `compliance` evaluation directly.

Maintenance schedules are loaded via `providers/traccarMaintenanceProvider.js` today. Swap the provider file to change GPS backend; hub shape stays the same.

### Engine

Derived intelligence: `status`, `health`, `maintenance`, `activity`, `fuel`, `costs`.

New calculators belong in `fuel-api/src/vehicleEngine/engine/` and `fuel-api/src/vehicleEngine/fuel/`.

#### `engine.fuel` snapshot (additive v1)

Authoritative fuel KPIs for UI — clients must not recompute range, consumption, or efficiency locally.

```json
{
  "efficiencyKmL": 9.2,
  "lPer100km": 10.9,
  "efficiencySource": "learned",
  "confidence": 72,
  "trend": "stable",
  "fleetDeltaPct": -3.5,
  "fleetEfficiencyAvg": 9.5,
  "risk": "low",
  "measured": true,
  "tankLevelPct": 45,
  "tankLevelSource": "telemetry",
  "capacityL": 75,
  "litresRemaining": 33.8,
  "estimatedRangeKm": 311,
  "estimatedFillCostZmw": 1085.5,
  "sampleCount": 6,
  "intervalCount": 4,
  "windowDays": 30,
  "measuredStats": {
    "totalDistanceKm": 2400,
    "totalFuelLitres": 260,
    "kmPerLitre": 9.2,
    "lPer100km": 10.9,
    "learnableIntervalCount": 4,
    "storedIntervalCount": 1,
    "rejectedIntervalCount": 0
  },
  "learned": {
    "currentEfficiency": 9.2,
    "confidence": 72,
    "trend": "stable",
    "totalObservations": 4
  }
}
```

`efficiencySource`: `learned` | `measured` | `spec` | `none`

Refuel writes capture odometer trust metadata (`odometerConfidenceAtCapture`, `isFullTank`) used by the interval validator and learning pipeline.


### Intelligence

Structured objects only — not prose paragraphs.

```json
{
  "version": 1,
  "findings": [{ "domain": "maintenance", "severity": "warning", "code": "...", "text": "..." }],
  "recommendations": [{ "domain": "maintenance", "action": "schedule_service", "text": "...", "severity": "warning" }]
}
```

Rule-based in v1; can become smarter later without breaking the contract.

### Timeline

Recent events built from existing DB records (service records, refuels, assignments). Event bus may become the source later; consumers do not care.

```json
{
  "id": "service.completed:uuid",
  "type": "service.completed",
  "occurredAt": "2026-06-25T10:00:00.000Z",
  "summary": "Oil change completed",
  "source": "service_records",
  "refs": { "serviceRecordId": "..." }
}
```

---

## Versioning

- Additive changes only within v1 (new fields OK).
- Breaking changes require `?version=2` or a new path.

## Deprecated

`GET /api/vehicles/:id/overview-metrics` — thin wrapper over engine slices. Use `/engine` for new work.
