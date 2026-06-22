# Fuel Operations Platform API

Operational days replace manual active/closed sessions. One operation per user per calendar day (fleet timezone).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `FLEET_TIMEZONE` | `Africa/Lusaka` | IANA timezone for day boundaries; snapshotted on each row as `fleetTimezone` |
| `OPERATION_LOCK_GRACE_MINUTES` | `15` | Minutes after midnight before an operation locks |

## Status model

| Status | Meaning |
|--------|---------|
| `draft` | Forecast editable; refuels not yet recordable |
| `approved` | ERB price and budget snapshotted; refuels recordable until lock time |
| `locked` | Time-derived (next day 00:00 + grace) or persisted; read-only |

Response DTOs include: `reference`, `effectiveStatus`, `isWritable`, `locksAt`, `canRecordFuel`, `canEditForecast`, `calendarDate`, `fleetTimezone`.

Every Fuel Day is assigned a human-friendly `reference` (e.g. `FD-20260621-001`), sequenced per fleet and calendar day. The UI shows the reference instead of the numeric `id`.

## Vehicle workflow

Each refuel line carries a derived `workflowStatus` so clients do not have to re-implement the rules:

| `workflowStatus` | Rule |
|------------------|------|
| `planned` | row exists, not arrived, not fueled, not skipped |
| `arrived` | `arrivedAt` set |
| `fueled` | `actualFuelLitres > 0` |
| `skipped` | `skippedAt` set |

## Endpoints

### List / details

- `GET /api/operation-sessions` — list operations (newest calendar day first)
- `GET /api/operation-sessions/:id` — operation + refuel lines

### Plan vehicles (find-or-create today)

```http
POST /api/operation-sessions/plan
{ "vehicles": [{ "vehicleId": 101, "plannedLitres": 310 }] }
```

Appends refuel rows for new device IDs. Allowed in `draft` or `approved` (writable); post-approval adds audit `VehicleAdded` and sets `approvalVarianceExists`.

### Forecast

- `GET /api/operation-sessions/:id/forecast` — history-based predictions + fleet summary
- `POST /api/operation-sessions/:id/forecast/regenerate` — `draft` only; updates `plannedFuelLitres` from predictions

### Approve (manager)

```http
POST /api/operation-sessions/:id/approve
```

Snapshots `approvedFuelPrice`, `approvedLitres`, `approvedBudget`, `approvedBy`, `approvedAt`. Sets status → `approved`.

### Record refuel (run page)

```http
POST /api/operation-sessions/:id/refuel
{
  "refuelId": 345,
  "actualFuelLitres": 31.8,
  "mileage": 221450,
  "mileageSource": "odometer",
  "overrideReason": "optional when mileage < previous"
}
```

Requires `approved` + writable. Stores `capturedBy`, `capturedAt`.

### Mark arrived / skip a vehicle (run page)

```http
POST /api/operation-sessions/:id/arrive   { "refuelId": 345 }
POST /api/operation-sessions/:id/skip      { "refuelId": 345, "reason": "Vehicle off-site" }
POST /api/operation-sessions/:id/unskip    { "refuelId": 345 }
```

All require `approved` + writable. `arrive` sets `arrivedAt`; `skip` sets `skippedAt`/`skippedBy`/`skipReason` (rejected if already fueled) and drops the vehicle out of the remaining count; `unskip` clears the skip.

### Close the Fueling Day (manager)

```http
POST /api/operation-sessions/:id/close
```

Locks the day and its refuel lines early (before the automatic day-end lock). Requires `approved`; idempotent when already `locked`.

### Legacy batch updates (still supported)

```http
POST /api/operation-sessions/:id/refuels
{ "updates": [{ "refuelId": 345, "plannedFuelLitres": 50, "actualFuelLitres": 31.8, "mileage": 221450 }] }
```

### Corrections (locked operations)

```http
POST /api/operation-sessions/:id/adjustments
{ "refuelId": 345, "field": "actualFuelLitres", "newValue": "32.5", "reason": "Pump receipt correction" }
```

### Supervisor unlock (manager)

```http
POST /api/operation-sessions/:id/unlock
{ "reason": "Late vehicle return", "durationMinutes": 30 }
```

### Reporting

- `GET /api/operation-sessions/reports/daily?calendarDate=2026-06-12`
- `GET /api/operation-sessions/reports/vehicles?vehicleId=101`
- `GET /api/operation-sessions/reports/management?month=2026-06`

### Vehicle statistics

- `GET /api/operation-sessions/vehicles/:vehicleId/statistics`

### Deprecated

- `POST /api/operation-sessions` with manual session create → prefer `POST /plan`

## Example `GET /api/operation-sessions/:id` response

```json
{
  "id": 88,
  "userId": 1,
  "reference": "FD-20260612-001",
  "calendarDate": "2026-06-12",
  "fleetTimezone": "Africa/Lusaka",
  "name": "Fuel operation — 2026-06-12",
  "sessionDate": "2026-06-12T00:00:00.000Z",
  "status": "approved",
  "effectiveStatus": "approved",
  "isWritable": true,
  "locksAt": "2026-06-13T00:15:00.000Z",
  "canRecordFuel": true,
  "canEditForecast": false,
  "approvedLitres": 620,
  "approvedBudget": 22010,
  "approvedFuelPrice": 35.5,
  "totalActualFuel": 310,
  "refuels": [
    {
      "id": 345,
      "vehicleId": 101,
      "workflowStatus": "fueled",
      "plannedFuelLitres": 310,
      "actualFuelLitres": 310,
      "arrivedAt": "2026-06-12T07:40:00.000Z",
      "skippedAt": null,
      "currentMileage": 221450,
      "mileageSource": "odometer",
      "locked": false
    }
  ]
}
```
