# OCI Production — Fuel Learning Evidence (read-only pull)

**Pulled:** 2026-07-05 from `ubuntu@129.151.163.95` (OCI `numznet`)  
**Method:** SSH read-only SQL + targeted `pg_dump` (no schema/code changes on OCI)

**Dump on NumzLab:** `backups/oci-fuel-evidence-2026-07-05/fuel_learning_tables.dump`  
Tables: `operation_session_refuels`, `vehicle_fuel_learning`, `vehicle_fuel_intervals`, `vehicle_specs`, `device_assignments`, `vehicles`, `companies`

---

## Fleet summary

| Metric | OCI production | NumzLab dev (prior) |
|--------|-----------------:|--------------------:|
| Completed refuels | **27** | 12 |
| Explicit full tank | **8** | 1 |
| Explicit partial | **19** | 11 |
| Suspicious partial (≥90% capacity) | **11** | 8 |
| With mileage | 27 | 12 |
| With odometer confidence | **8** | 1 |
| Active assignments | 4 | 1 |
| Vehicles (total) | 4 | — |
| Distinct devices with refuels | **7** | 4 |

**Still insufficient for fleet parameter tuning:** `learnable_intervals = 0` on OCI as well.

---

## Vehicles and refuel coverage

| deviceId | Vehicle | Refuels | Full | Partial | Active |
|----------|---------|--------:|-----:|--------:|--------|
| 5 | BOOMER | 5 | 2 | 3 | yes |
| 2 | (unassigned) | 4 | 0 | 4 | no |
| 1 | (unassigned) | 4 | 0 | 4 | no |
| 6 | LIGHT TRUCK | 4 | 2 | 2 | yes |
| 4 | TOYOTA ALLION | 4 | 2 | 2 | yes |
| 8 | JUKE | 4 | 2 | 2 | yes |
| 3 | (unassigned) | 2 | 0 | 2 | no |

**Anchors:** 4 active vehicles have explicit full-tank refuels (Jul 2026). Devices 1–3 have **no** full-tank rows (all `isFullTank=false`, many pre-feature).

---

## Learning pipeline state (production, pre–Increment 2 deploy)

| Metric | Count |
|--------|------:|
| `vehicle_fuel_learning` rows | 4 |
| `vehicle_fuel_intervals` rows | 8 |
| LEARNABLE | **0** |
| STORED_ONLY | 2 |
| REJECTED | 6 |
| Anomalous | 0 |
| Learning rows with observations | **0** (all stub, empty `efficiency_history`) |

---

## Why every interval failed (root cause)

All 8 persisted intervals pair a **Jul 2026 full-tank refuel** against an **older partial** refuel. Mileage snapshots on historical partials are stale or wrong → **odometer backwards** or **previous_partial_fill** (after Inc 2).

| Vehicle | cur→prev | Δ km | prev full? | cur full? | Likely reason |
|---------|----------|-----:|------------|-----------|---------------|
| TOYOTA ALLION | 43←14 | −2,270 | partial | full | `odometer_backwards` |
| TOYOTA ALLION | 47←35 | −1,705,038 | partial | full | `odometer_backwards` |
| BOOMER | 44←24 | +72 | partial | full | `previous_partial_fill` / low odo conf |
| BOOMER | 48←36 | +339 | partial | full | `previous_partial_fill` (would be ~7.1 km/L if full→full) |
| LIGHT TRUCK | 45←25 | −100,356 | partial | full | `odometer_backwards` |
| LIGHT TRUCK | 49←37 | −106,017 | partial | full | `odometer_backwards` |
| JUKE | 46←26 | −215,352 | partial | full | `odometer_backwards` |
| JUKE | 50←38 | −215,404 | partial | full | `odometer_backwards` |

**Pattern:** Pre-July refuels share repeated mileage (e.g. 374259, 5521) or wild jumps when odometer capture began. Full-tank Jul rows have plausible mileage + `odometerConfidenceAtCapture`.

**Implication for backtest:** Production confirms Inc 2 fixes are necessary (chronological pairing, `previous_partial_fill`, anchor semantics). A **full→full** pair on BOOMER (44→48) would be ~340 km / 47.5 L ≈ **7.2 km/L** — the first likely LEARNABLE interval once hardened pairing runs on redeploy/backfill.

---

## `isFullTank` data quality

- 19/27 rows `isFullTank=false` including **11** at ≥90% of `tankCapacitySnapshot` (suspicious — likely pre-feature default or operator never unchecked).
- Only **8** Jul 2026 rows have `odometerConfidenceAtCapture` (feature `20260702_refuel_odometer_capture`).
- Do **not** silently reclassify historical partials.

---

## Decision impact (OCI evidence)

| Decision | OCI supports |
|----------|----------------|
| Pairing protection **ADOPT** | **Yes** — 8/8 intervals are partial→full poisoned |
| Chronological pairing **ADOPT** | **Yes** — wrong predecessor caused backwards odometer |
| Envelope MAD **ADOPT** | **No fleet proof yet** — 0 learnable intervals to tune against |
| Bounded adaptation **DEFER** | **Yes** — still deferred |
| Fuel State **GO** | **NO** — 0 learnable, mileage history unreliable before Jul 2026 |

---

## Next step on NumzLab (no OCI changes)

Restore dump into dev DB (or isolated schema) and re-run:

```bash
# Example: restore fuel tables to dev (after backup)
pg_restore -d numztrak_fuel --clean --if-exists backups/oci-fuel-evidence-2026-07-05/fuel_learning_tables.dump

docker exec numzfleet-dev-fuel-api node src/scripts/backtestFuelLearning.js --out ./backtest-output/oci
```

Then **backfill** learning with Inc 2 code after deploy to materialize full→full intervals.

---

## Commands used (read-only on OCI)

```bash
ssh oci-production   # ~/.ssh/config → 129.151.163.95
source /home/ubuntu/NUMZFLEET/backend/.env
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" numzfleet-prod-db psql -U numztrak -d numztrak_fuel ...
docker exec ... pg_dump -U numztrak -d numztrak_fuel -Fc --no-owner -t operation_session_refuels ...
scp oci-production:.../fuel_learning_tables.dump backups/oci-fuel-evidence-2026-07-05/
```
