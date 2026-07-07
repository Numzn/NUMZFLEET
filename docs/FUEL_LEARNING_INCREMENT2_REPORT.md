# Fuel Learning Hardening — Increment 2 Report

**Date:** 2026-07-05  
**Dataset:** NumzLab dev (`numzfleet-dev-db`) — no production snapshot available on host

---

## 1. Dataset used

| Source | Status |
|--------|--------|
| Production DB snapshot/clone | Not available (`~/NUMZFLEET-backups/` empty) |
| Read-only production | Not configured |
| **NumzLab dev DB** | Used — read-only queries only |

---

## 2. Evidence quality

| Metric | Value |
|--------|------:|
| Total completed refuels | 12 |
| Explicit full tank (`isFullTank=true`) | 1 |
| Explicit partial (`isFullTank=false`) | 11 |
| Suspicious partial (≥90% tank capacity) | 8 |
| Partial→full chains | 1 |
| Distinct vehicles with refuels | 4 |
| Active assignments | 1 |
| Vehicles with full-tank anchor | 1 (device 4) |
| Vehicles without anchor | 3 (devices 1, 2, 3) |
| Learnable intervals | **0** |
| Rejected intervals | 6 |
| Stored only | 2 |
| Odometer invalid | 6 |
| Anomalous at gate | 0 |

**Conclusion:** Dev fleet is **insufficient** for fleet-derived parameter tuning. Decisions below combine dev evidence + audit unit tests.

Artifacts: `fuel-api/backtest-output/inc2/backtest-report.json`

---

## 3. S0–S3 + AFTER results

Only device 4 had ≥2 refuels with active assignment. All scenarios: baseline 10 km/L (spec seed), 0 accepted, 0 quarantined — sole interval `odometer_backwards`.

| Scenario | Accepted | Quarantined | Max displacement % |
|----------|----------|-------------|-------------------|
| S0 (legacy pipeline) | 0 | 0 | 0 |
| S1 (+ previous-full gate) | 0 | 0 | 0 |
| S2 (envelope MAD) | 0 | 0 | 0 |
| S3 (envelope + bounded 15%) | 0 | 0 | 0 |
| AFTER (hardened production) | 0 | 0 | 0 |

S0 vs AFTER: **0% baseline delta**, no acceptance change on dev.

---

## 4. Decision table

| Area | Decision | Rationale |
|------|----------|-----------|
| **Pairing protection** | **ADOPT** | Correctness fix #6 + #8; `previous_partial_fill` in validator; chronological pairing via `resolveChronologicalPreviousRefuel` |
| **Operating envelope** | **ADOPT MAD with σ fallback** | Fleet insufficient; audit tests prove MAD quarantines σ=0 hole; `ENVELOPE_GATING.enabled=true`, falls back to 3σ when `n < minSamples` |
| **Bounded adaptation** | **INSUFFICIENT EVIDENCE — DEFER** | `BOUNDED_DISPLACEMENT_PCT=null` in config |
| **Maturity rules** | **INSUFFICIENT EVIDENCE — read-only only** | Exposed via `loadFuelLearningState()`; does not alter learning |

---

## 5. Exact changes implemented

### Correctness defects (always)

- **`intervalValidator.js`**: `previous_partial_fill` gate when `previous.isFullTank === false`
- **`fuelLearningPairing.js`**: chronological predecessor (fixes wrong-pair fallback #8)
- **`fuelLearningService.js`**: lookback 100 refuels; removed dead `detectEfficiencyAnomaly(x, [])` call
- **`fuelEvidenceClassifier.js`**: NORMAL / OUTLIER / QUARANTINED / REJECTED boundary
- **`fuelLearningConfig.js`**: explicit configuration object

### Evidence-backed hardening

- **Envelope gating**: `gateEfficiencyObservation()` — MAD when history sufficient, else 3σ
- **Maturity read-only**: `loadFuelLearningState()` returns `modelMaturity`, `maturitySignals`, `operatingEnvelope`
- **`fuelSnapshotBuilder.js`**: passes maturity/envelope through `learned` block

### Tooling

- **`fuelLearningSimulation.js`**: shared S0–S3 + AFTER simulation
- **`fuelLearningEvidenceAnalysis.js`**: fleet evidence quality report
- **`backtestFuelLearning.js`**: extended with evidence + decision table + AFTER scenario

---

## 6. Exact changes deferred

- `fuelStateService.js` implementation (**NO-GO** — see contract)
- Bounded displacement cap in live learning
- Maturity-driven learning behavior changes
- `isFullTank` tri-state schema / historical reclassification
- Fueling Day / Prediction Engine / Suggestion Engine changes
- Production fleet backtest (no snapshot access)

---

## 7. Files changed

| File | Action |
|------|--------|
| `fuel-api/src/vehicleEngine/fuel/fuelLearningConfig.js` | Created |
| `fuel-api/src/vehicleEngine/fuel/fuelEvidenceClassifier.js` | Created |
| `fuel-api/src/vehicleEngine/fuel/fuelEvidenceClassifier.test.js` | Created |
| `fuel-api/src/vehicleEngine/fuel/fuelLearningPairing.js` | Created |
| `fuel-api/src/vehicleEngine/fuel/fuelLearningPairing.test.js` | Created |
| `fuel-api/src/vehicleEngine/fuel/fuelLearningSimulation.js` | Created |
| `fuel-api/src/vehicleEngine/fuel/fuelLearningEvidenceAnalysis.js` | Created |
| `fuel-api/src/vehicleEngine/fuel/fuelLearningService.js` | Rewired |
| `fuel-api/src/vehicleEngine/fuel/intervalValidator.js` | `previous_partial_fill` + `checkPreviousFullTank` param |
| `fuel-api/src/vehicleEngine/fuel/intervalValidator.test.js` | Added test |
| `fuel-api/src/vehicleEngine/fuel/fuelSnapshotBuilder.js` | Maturity fields on `learned` |
| `fuel-api/src/scripts/backtestFuelLearning.js` | Refactored |
| `docs/FUEL_STATE_SERVICE_CONTRACT.md` | Created |
| `docs/FUEL_LEARNING_INCREMENT2_REPORT.md` | This report |
| `fuel-api/backtest-output/inc2/*` | Harness output |

**Untouched:** `learningEngine.js`, `anomalyDetector.js`, Prediction/Suggestion/Fueling Day paths

---

## 8. Tests added

- `fuelEvidenceClassifier.test.js` (7 tests)
- `fuelLearningPairing.test.js` (3 tests)
- `intervalValidator.test.js` — `previous_partial_fill`
- `fuelLearningAuditScenarios.test.js` (5 audit reproduction tests, from Inc 1)

**Total fuel tests: 35 pass**

---

## 9. Commands run

```bash
docker exec numzfleet-dev-fuel-api node --test src/vehicleEngine/fuel/
docker exec numzfleet-dev-fuel-api node src/scripts/backtestFuelLearning.js --out /tmp/backtest-inc2
./scripts/verify   # API port failed (pre-existing stack issue); UI/Traccar OK
```

---

## 10. Pass/fail results

| Check | Result |
|-------|--------|
| Unit tests `src/vehicleEngine/fuel/` | **PASS** (35/35) |
| Backtest read-only (DB rows unchanged) | **PASS** |
| Stack verify API :3000 | **FAIL** (unrelated runtime) |
| Production data backtest | **SKIPPED** (no snapshot) |

---

## 11. Before vs after learning behavior

| Behavior | Before (Inc 1 production) | After (Inc 2) |
|----------|---------------------------|---------------|
| Previous refuel pairing | Desc sort + `sorted[1]` fallback | Chronological predecessor, 100-row lookback |
| Partial→full intervals | Could be LEARNABLE | `STORED_ONLY` / QUARANTINED |
| Anomaly gate | 3σ only | MAD envelope when n≥3, else 3σ |
| Dead anomaly call | Present | Removed |
| Outlier learning | Blocked by `isAnomalous` | Blocked by `classifyEvidence` OUTLIER |
| Interval persistence | Yes | Yes (unchanged) |
| Maturity in API | No | Yes (read-only on `loadFuelLearningState`) |

On dev fleet: no material baseline change (0 learnable intervals).

---

## 12. Remaining risks

1. **8/11 partial rows** are suspiciously near tank capacity — `isFullTank=false` may be unreliable historically; we did **not** reclassify them.
2. **Fleet parameter validation pending** — MAD multiplier (3) is audit-default, not fleet-tuned.
3. **Single assignment** in dev — most refuel vehicles inactive.
4. **Odometer data quality** — 6/8 intervals odometer-invalid on dev.
5. **Bounded adaptation untested** on real fleet.

---

## 13. Fuel State implementation contract

See [`docs/FUEL_STATE_SERVICE_CONTRACT.md`](FUEL_STATE_SERVICE_CONTRACT.md).

---

## 14. GO / NO-GO for `fuelStateService.js`

### **NO-GO**

| Criterion | Required | Dev status |
|-----------|----------|------------|
| ≥10 learnable intervals fleet-wide | Yes | 0 |
| Maturity params fleet-validated | Yes | No |
| Reliable anchor chains | Yes | 1 vehicle, 0 learnable |
| Odometer quality | Yes | Poor on dev |

**Proceed with Fuel State only after production-scale backtest on OCI snapshot restore.**
