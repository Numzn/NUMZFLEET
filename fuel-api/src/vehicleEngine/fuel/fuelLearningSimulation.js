/**
 * In-memory fuel learning pipeline simulation for backtest harness.
 * Reuses production classifiers/validators — no DB writes.
 */
import { validateInterval, INTERVAL_STATUS } from './intervalValidator.js';
import { isLearnableInterval } from './intervalBuilder.js';
import { applyLearningUpdate } from './learningEngine.js';
import { detectEfficiencyAnomaly } from './anomalyDetector.js';
import { computeOperatingEnvelope, classifyObservation } from './fuelOperatingEnvelope.js';
import { deriveModelMaturity } from './fuelModelMaturity.js';
import {
  gateEfficiencyObservation,
  classifyEvidence,
} from './fuelEvidenceClassifier.js';
import { resolveChronologicalPreviousRefuel } from './fuelLearningPairing.js';
import { isConfirmedFull } from './fuelFillClassification.js';
import {
  ENVELOPE_GATING,
  MATURITY_PARAMS,
  BOUNDED_DISPLACEMENT_PCT,
} from './fuelLearningConfig.js';

function emptyLearningState(specEfficiency) {
  return {
    currentEfficiency: specEfficiency ?? null,
    confidence: 0,
    trend: 'stable',
    totalObservations: 0,
    totalDistanceKm: 0,
    efficiencyHistory: [],
    lastIntervalAt: null,
  };
}

/** Legacy pairing (#8 bug): desc sort + wrong fallback. */
function resolveLegacyPreviousRefuel(refuelRows, currentRefuelId) {
  const sorted = [...refuelRows].sort(
    (a, b) => new Date(b.sessionDate || b.createdAt) - new Date(a.sessionDate || a.createdAt),
  );
  const curIdx = sorted.findIndex((r) => Number(r.id) === Number(currentRefuelId));
  return curIdx >= 0 ? sorted[curIdx + 1] : sorted[1] ?? null;
}

function applyBoundedUpdate(state, efficiencyKmL, options, maxDisplacementPct) {
  const prior = state?.currentEfficiency != null ? Number(state.currentEfficiency) : null;
  const updated = applyLearningUpdate(state, efficiencyKmL, options);
  if (prior == null || maxDisplacementPct == null || prior <= 0) return updated;

  const displacementPct = Math.abs((updated.currentEfficiency - prior) / prior) * 100;
  if (displacementPct <= maxDisplacementPct) return updated;

  const direction = updated.currentEfficiency >= prior ? 1 : -1;
  const capped = prior * (1 + (direction * maxDisplacementPct) / 100);
  const history = [...(state?.efficiencyHistory ?? [])];
  history.push(efficiencyKmL);
  return {
    ...updated,
    currentEfficiency: Number(capped.toFixed(4)),
    efficiencyHistory: history.slice(-20),
  };
}

function isFullTankRefuel(refuel) {
  return isConfirmedFull(refuel);
}

function gateForScenario(efficiencyKmL, history, scenario, envelopeParams) {
  if (scenario.pipeline === 'after' && scenario.useProductionGate) {
    return gateEfficiencyObservation(efficiencyKmL, history, ENVELOPE_GATING);
  }
  if (scenario.useEnvelope) {
    const envelope = computeOperatingEnvelope(history, envelopeParams);
    const classification = classifyObservation(efficiencyKmL, envelope);
    if (classification === 'outlier') {
      return { isAnomalous: true, reason: 'envelope_outlier', gate: 'envelope' };
    }
    return { isAnomalous: false, reason: null, gate: 'envelope' };
  }
  return { ...detectEfficiencyAnomaly(efficiencyKmL, history), gate: 'sigma' };
}

/**
 * @param {object[]} refuels
 * @param {object} spec
 * @param {object} scenario
 * @param {object} envelopeParams
 */
export function simulateVehicleRefuels(refuels, spec, scenario, envelopeParams) {
  const sorted = [...refuels].sort(
    (a, b) => new Date(a.sessionDate || a.createdAt) - new Date(b.sessionDate || b.createdAt),
  );

  let state = emptyLearningState(spec?.fuelEfficiency ?? null);
  const trajectory = [];
  const intervalLog = [];
  const calibrationSeries = [];
  let lastFullTankRefuel = null;

  const counts = {
    accepted: 0,
    quarantined: 0,
    rejected: 0,
    storedOnly: 0,
    flagged: 0,
    byReason: {},
    byEvidenceClass: {},
  };

  let maxDisplacementPct = 0;
  const useHardened = scenario.pipeline === 'after' || scenario.hardened === true;
  const checkPreviousFullTank = useHardened || scenario.previousFullGate;

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const previous = useHardened
      ? resolveChronologicalPreviousRefuel(refuels, current.id)
      : resolveLegacyPreviousRefuel(refuels, current.id);

    if (!previous) continue;

    const validation = validateInterval({
      previous,
      current,
      tankCapacity: spec?.tankCapacity ?? current.tankCapacitySnapshot,
      specEfficiencyKmL: spec?.fuelEfficiency ?? null,
      checkPreviousFullTank,
    });

    const learnable = isLearnableInterval(validation);
    let gateResult = { isAnomalous: false, reason: null };
    if (learnable && validation.efficiencyKmL != null) {
      gateResult = gateForScenario(
        validation.efficiencyKmL,
        state.efficiencyHistory,
        scenario,
        envelopeParams,
      );
    }

    const evidence = useHardened
      ? classifyEvidence({ validation, gateResult })
      : {
        shouldLearn: learnable && !gateResult.isAnomalous,
        evidenceClass: !learnable
          ? (validation.status === INTERVAL_STATUS.REJECTED ? 'REJECTED' : 'QUARANTINED')
          : (gateResult.isAnomalous ? 'OUTLIER' : 'NORMAL'),
        reason: validation.reason ?? gateResult.reason,
      };

    const priorBaseline = state.currentEfficiency;
    let accepted = false;
    let quarantineReason = null;

    if (!learnable) {
      if (validation.status === INTERVAL_STATUS.REJECTED) counts.rejected += 1;
      else if (validation.status === INTERVAL_STATUS.FLAGGED) counts.flagged += 1;
      else counts.storedOnly += 1;
      quarantineReason = validation.reason ?? validation.status;
    } else if (!evidence.shouldLearn) {
      counts.quarantined += 1;
      quarantineReason = evidence.reason ?? gateResult.reason;
    } else {
      const boundedCap = scenario.boundedDisplacementPct ?? BOUNDED_DISPLACEMENT_PCT;
      const updateFn = boundedCap != null
        ? (s, eff, opts) => applyBoundedUpdate(s, eff, opts, boundedCap)
        : applyLearningUpdate;

      const before = state.currentEfficiency;
      state = updateFn(state, validation.efficiencyKmL, {
        distanceKm: validation.distanceKm,
        eventAt: current.sessionDate || current.createdAt,
      });
      accepted = true;
      counts.accepted += 1;

      if (before != null && before > 0 && state.currentEfficiency != null) {
        const disp = Math.abs((state.currentEfficiency - before) / before) * 100;
        if (disp > maxDisplacementPct) maxDisplacementPct = disp;
      }
    }

    if (quarantineReason) {
      counts.byReason[quarantineReason] = (counts.byReason[quarantineReason] ?? 0) + 1;
    }
    counts.byEvidenceClass[evidence.evidenceClass] = (counts.byEvidenceClass[evidence.evidenceClass] ?? 0) + 1;

    intervalLog.unshift({
      refuelId: current.id,
      previousRefuelId: previous.id,
      validationStatus: validation.status,
      reason: validation.reason,
      evidenceClass: evidence.evidenceClass,
      efficiencyKmL: validation.efficiencyKmL ?? null,
      accepted,
      baselineAfter: state.currentEfficiency,
      eventAt: current.sessionDate || current.createdAt,
    });

    trajectory.push({
      refuelId: current.id,
      baseline: state.currentEfficiency,
      accepted,
      efficiencyKmL: validation.efficiencyKmL ?? null,
    });

    if (isFullTankRefuel(current) && validation.distanceKm != null && priorBaseline != null && priorBaseline > 0) {
      const distanceSinceFull = lastFullTankRefuel
        ? Number(current.currentMileage) - Number(lastFullTankRefuel.currentMileage)
        : validation.distanceKm;

      if (distanceSinceFull > 0 && Number(current.actualFuelLitres) > 0) {
        const predictedLitres = distanceSinceFull / priorBaseline;
        const actualLitres = Number(current.actualFuelLitres);
        calibrationSeries.push({
          refuelId: current.id,
          predictedLitres: Number(predictedLitres.toFixed(2)),
          actualLitres,
          errorLitres: Number((predictedLitres - actualLitres).toFixed(2)),
          baselineAtTime: priorBaseline,
          distanceKm: Number(distanceSinceFull.toFixed(2)),
        });
      }
    }

    if (isFullTankRefuel(current)) {
      lastFullTankRefuel = current;
    }
  }

  const envelope = computeOperatingEnvelope(state.efficiencyHistory, envelopeParams);
  const maturity = deriveModelMaturity({
    learningState: state,
    recentIntervals: intervalLog,
    envelope,
    params: MATURITY_PARAMS,
  });

  return {
    finalBaseline: state.currentEfficiency,
    finalConfidence: state.confidence,
    totalObservations: state.totalObservations,
    trajectory,
    intervalLog,
    calibrationSeries,
    counts,
    maxDisplacementPct: Number(maxDisplacementPct.toFixed(2)),
    maturity: maturity.state,
    maturitySignals: maturity.signals,
    refuelCount: sorted.length,
    intervalCount: sorted.length > 1 ? sorted.length - 1 : 0,
  };
}

export const SCENARIOS = {
  S0: {
    id: 'S0', name: 'current_pipeline', pipeline: 'before', useEnvelope: false, previousFullGate: false, boundedDisplacementPct: null,
  },
  S1: {
    id: 'S1', name: 'previous_full_gate', pipeline: 'before', useEnvelope: false, previousFullGate: true, boundedDisplacementPct: null,
  },
  S2: {
    id: 'S2', name: 'envelope_gating', pipeline: 'before', useEnvelope: true, previousFullGate: false, boundedDisplacementPct: null,
  },
  S3: {
    id: 'S3', name: 'envelope_bounded_alpha', pipeline: 'before', useEnvelope: true, previousFullGate: false, boundedDisplacementPct: 15,
  },
  AFTER: {
    id: 'AFTER', name: 'hardened_production', pipeline: 'after', useProductionGate: true, boundedDisplacementPct: null,
  },
};

export const ENVELOPE_GRID = [
  { method: 'median_mad', madMultiplier: 2, minSamples: 3 },
  { method: 'median_mad', madMultiplier: 3, minSamples: 3 },
  { method: 'median_mad', madMultiplier: 4, minSamples: 3 },
  { method: 'iqr', iqrMultiplier: 1.5, minSamples: 3 },
];

export const DEFAULT_ENVELOPE_PARAMS = { method: 'median_mad', madMultiplier: 3, minSamples: 3 };

export default {
  simulateVehicleRefuels,
  SCENARIOS,
  ENVELOPE_GRID,
  DEFAULT_ENVELOPE_PARAMS,
};
