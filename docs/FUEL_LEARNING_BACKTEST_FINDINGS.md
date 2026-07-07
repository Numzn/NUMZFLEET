# Fuel Learning Backtest Findings

Generated from Increment 1 tooling: read-only harness + pure-function maturity/envelope modules.
Run date: 2026-07-05 (NumzLab dev database).

## What was delivered

| Artifact | Path |
|----------|------|
| Operating envelope (median/MAD + IQR) | `fuel-api/src/vehicleEngine/fuel/fuelOperatingEnvelope.js` |
| Model maturity (six lifecycle states) | `fuel-api/src/vehicleEngine/fuel/fuelModelMaturity.js` |
| Backtest harness (S0–S3) | `fuel-api/src/scripts/backtestFuelLearning.js` |
| Audit scenario unit tests | `fuel-api/src/vehicleEngine/fuel/fuelLearningAuditScenarios.test.js` |

**No production learning code was changed.** `learningEngine.js`, `anomalyDetector.js`, `intervalValidator.js`, and `fuelLearningService.js` are untouched.

## How to run

```bash
# Unit tests (host or container)
docker exec numzfleet-dev-fuel-api node --test src/vehicleEngine/fuel/

# Backtest (read-only — verifies vehicle_fuel_learning.updated_at unchanged)
docker exec numzfleet-dev-fuel-api node src/scripts/backtestFuelLearning.js --out /tmp/backtest-output
```

Outputs: `backtest-report.json` (per-vehicle trajectories) + `backtest-summary.md` (fleet aggregates).

## Audit verdict (confirmed in code + unit tests)

**YES — the EWMA baseline can be polluted.** Verified vectors:

1. First observation seeds baseline directly; anomaly detector inactive until history ≥ 3.
2. σ = 0 when history values are identical → 3σ accepts any reading.
3. Noisy small samples (e.g. [5, 12, 8]) let 3.2 km/L pass 3σ (z ≈ 1.8).
4. Single accepted outlier at baseline 8.0, alpha 0.3 → 6.56 km/L (−18% displacement) — reproduced in `fuelLearningAuditScenarios.test.js`.
5. Confidence rises with observation count only (`obs × 12`), not agreement quality.
6. `intervalValidator` does not check `previous.isFullTank` — partial→full pairs can be LEARNABLE (bug #6).
7. `isFullTank` boolean conflates partial with pre-feature rows (DB default `false`, UI default `true`).
8. Wrong-pair fallback when refuel outside newest-10 window (`fuelLearningService.js:64-65`).
9. Dead `detectEfficiencyAnomaly(x, [])` call at `fuelLearningService.js:78-80`.

**Median/MAD envelope** quarantines the σ = 0 case that 3σ misses (unit test confirmed).

## NumzLab dev fleet results (sparse)

| Scenario | Vehicles | LEARNABLE accepted | Quarantined | Avg baseline (km/L) |
|----------|----------|-------------------|-------------|---------------------|
| S0 current pipeline | 1 | 0 | 0 | 10 (spec seed) |
| S1 previous-full gate | 1 | 0 | 0 | 10 |
| S2 envelope gating | 1 | 0 | 0 | 10 |
| S3 envelope + bounded α | 1 | 0 | 0 | 10 |

**S0 vs S1:** device 4 baseline delta **0%** (no learnable intervals in either scenario).

**Root cause on dev:** the sole vehicle interval was `REJECTED` (`odometer_backwards`). No calibration-error series could be computed (requires full-tank events with valid distance).

**Implication:** parameter selection (envelope `madMultiplier`, maturity cutoffs, bounded-alpha cap) **cannot be finalized from dev data alone**. Re-run harness against production fleet export or OCI snapshot when available.

## Envelope parameter grid (dev fleet)

All grid points (MAD multipliers 2/3/4, IQR 1.5) produced identical results on dev — zero quarantined, zero accepted — due to lack of learnable intervals.

## Recommendations (pending fleet evidence)

| Decision | Status | Next step |
|----------|--------|-----------|
| Previous-full gate (S1) | Dev: no impact | Re-run on fleet with partial→full pairs; expect material delta on affected vehicles |
| Envelope vs 3σ (S2) | Unit tests favor MAD for σ=0 | Grid search on production replay; compare quarantine false-positive rate |
| Bounded alpha 15% (S3) | Not exercised on dev | Validate on vehicles with ≥5 learnable intervals |
| Maturity cutoffs | Defaults in `deriveModelMaturity` params only | Derive from backtest distribution of `totalObservations` + anomaly rate |
| Live wiring | **Blocked** | Decision gate: production harness run + review per-vehicle JSON trajectories |

## Scenarios reference

| ID | Description |
|----|-------------|
| S0 | Production control: `validateInterval` + 3σ `detectEfficiencyAnomaly` |
| S1 | S0 + require `previous.isFullTank !== false` |
| S2 | `validateInterval` + median/MAD envelope gating |
| S3 | S2 + cap single-interval baseline displacement (15% param in harness) |

## Decision gate

Do **not** wire envelope/maturity into `fuelLearningService.js` until:

1. Harness run on a dataset with ≥10 learnable intervals across multiple vehicles.
2. S1 vs S0 comparison shows acceptable trade-off (bug #6 fix vs lost valid intervals).
3. Envelope grid picks a method with documented false-positive/false-negative rates.
4. Bounded-alpha cap validated against max displacement distribution.

After gate: wiring increment (classifier, bugs #6/#8/#9, bounded `applyLearningUpdate`).
