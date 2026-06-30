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

### Rule 4

> Domain modules own writes.

- Fuel owns fuel transactions.
- Maintenance owns work orders and service records.
- Trips own trip records.

The Vehicle Engine reads those records and produces a unified view. It does not own the write models.

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

## Six responsibilities

Nothing more. The response has exactly these top-level layers:

| # | Layer | Question |
|---|-------|----------|
| 1 | `registry` | What is this vehicle? (identity, spec, assignment) |
| 2 | `capabilities` | What can this vehicle support? (UI feature flags) |
| 3 | `hub` | What do we know right now? (facts, not opinions) |
| 4 | `engine` | What do those facts mean? (scores, KPIs, urgency) |
| 5 | `intelligence` | What should we do? (findings + recommendations) |
| 6 | `timeline` | What has happened? (recent history) |

```text
Vehicle Engine
├── Registry
├── Capabilities
├── Hub
├── Engine
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

Normalized facts: `telemetry`, `fuel`, `maintenance`, `repairs`. No scores.

Maintenance schedules are loaded via `providers/traccarMaintenanceProvider.js` today. Swap the provider file to change GPS backend; hub shape stays the same.

### Engine

Derived intelligence: `status`, `health`, `maintenance`, `fuel`, `costs`.

New calculators belong in `fuel-api/src/vehicleEngine/engine/`.

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
