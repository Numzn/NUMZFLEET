/**
 * Fuel learning hardening configuration.
 * Values are explicit — fleet backtest on NumzLab dev DB (2026-07-05) had
 * INSUFFICIENT EVIDENCE for parameter tuning (12 refuels, 0 learnable intervals).
 * σ=0 and pollution scenarios are covered by unit tests (fuelLearningAuditScenarios.test.js).
 */

/** Require previous refuel not explicitly partial (correctness fix #6). */
export const PREVIOUS_FULL_GATE_ENABLED = true;

/**
 * Operating envelope gating. When history length < minSamples, falls back to 3σ detector.
 * Method chosen from audit: median/MAD quarantines σ=0 hole that 3σ misses.
 *
 * DISABLED for live learning (Increment 3): the 2026-07-05 dev backtest had 12 refuels /
 * 0 learnable intervals, so madMultiplier/minSamples are not fleet-tuned. Unvalidated
 * parameters must not govern live learning. gateEfficiencyObservation falls back to the
 * 3σ detector when disabled; envelope exposure, simulation, and backtest support keep
 * using these method params.
 */
export const ENVELOPE_GATING = {
  enabled: false,
  method: 'median_mad',
  madMultiplier: 3,
  minSamples: 3,
};

/** Bounded single-interval displacement cap (%). null = disabled (deferred — insufficient fleet evidence). */
export const BOUNDED_DISPLACEMENT_PCT = null;

/** Maturity derivation params (read-only exposure; does not alter learning). */
export const MATURITY_PARAMS = {
  coldStartMaxObs: 0,
  learningMaxObs: 2,
  stabilizingMinObs: 3,
  matureMinObs: 5,
  matureMinConfidence: 60,
  shiftSuspectQuarantineCount: 2,
  recalibratingAcceptedInBandCount: 3,
  recentWindow: 10,
};

/** Max completed refuels fetched when resolving chronological previous refuel. */
export const REFUEL_PAIRING_LOOKBACK = 100;

export default {
  PREVIOUS_FULL_GATE_ENABLED,
  ENVELOPE_GATING,
  BOUNDED_DISPLACEMENT_PCT,
  MATURITY_PARAMS,
  REFUEL_PAIRING_LOOKBACK,
};
