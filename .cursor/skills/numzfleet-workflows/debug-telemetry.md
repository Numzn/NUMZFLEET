# Debug Telemetry

## When to use

- Missing or wrong GPS data: fuel %, RPM, coolant, ignition, speed, odometer distance.
- Device reports in Traccar but fleet UI shows stale/empty telemetry.
- Vendor-specific attribute key mismatches.

## Data flow

```text
GPS device → Traccar (MySQL positions) → fuel-api / frontend
                ↓
         position.attributes (vendor keys vary)
                ↓
    normalizePositionTelemetry() → unified shape
                ↓
    Vehicle Engine telemetry hub → UI / capabilities
```

## Normalization (single contract)

Both sides must stay aligned:

| Location | File |
|----------|------|
| fuel-api | `fuel-api/src/utils/normalizeTelemetry.js` |
| frontend | `traccar-fleet-system/frontend/src/fleet/vehicleDetail/telemetryUtils.js` |

Normalized fields: `rpm`, `coolantC`, `engineLoadPct`, `fuelPct`, `totalDistance`, `ignition`, `speedLimitKph` (+ frontend extras: battery, tire pressure).

Fuel % resolves via `normalizeFuelLevelFromAttrs` — check `normalizeFuelLevel.js` on both sides.

## Debug steps

### 1. Confirm device is live in Traccar

- Traccar UI: `http://track.fleet.numzlab` or `http://localhost:8082`
- Check last position time and raw attributes on the device.

### 2. Inspect raw attributes

In Traccar, open device → latest position → attributes JSON. Note exact key names (e.g. `fuel`, `fuelLevel`, `obdFuel`).

### 3. Check fuel-api merge

`useVehicleData` merges API position with live Redux socket position — live wins for `fuelPct` and speed when socket is connected.

### 4. Check assignment

Vehicle must have `assignment.deviceId` linking fleet vehicle UUID to Traccar device. Without it: no live socket, capabilities show `gps: false`.

### 5. Service logs

```bash
./scripts/logs
# or
docker compose logs -f backend traccar
```

### 6. Odometer vs totalDistance

- `totalDistance` in telemetry = raw Traccar counter (evidence).
- Live `odometerKm` = Vehicle Odometer Engine (anchored/telemetry-only modes). See `docs/VEHICLE_ODOMETER_STANDARD.md`.

## Common causes

| Symptom | Likely cause |
|---------|--------------|
| Fuel always null | Vendor key not mapped in `normalizeFuelLevelFromAttrs` |
| Stale speed/fuel | Socket disconnected; only API snapshot shown |
| RPM/coolant missing | Device doesn't send OBD; not a bug |
| Wrong capability flags | `capabilitiesBuilder` reads hub — fix upstream telemetry |

## Fix pattern

1. Add vendor key alias to **both** normalize files (fuel-api + frontend).
2. Add/adjust unit test if fuel-api side changes.
3. Rebuild or hot-reload depending on what changed.

Do **not** add a third parallel telemetry resolver in a feature module.
