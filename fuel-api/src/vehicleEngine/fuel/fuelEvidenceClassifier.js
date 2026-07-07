import { INTERVAL_STATUS } from './intervalValidator.js';
import { isLearnableInterval } from './intervalBuilder.js';
import { detectEfficiencyAnomaly } from './anomalyDetector.js';
import { computeOperatingEnvelope, classifyObservation } from './fuelOperatingEnvelope.js';
import {
  ENVELOPE_GATING,
} from './fuelLearningConfig.js';

export const EVIDENCE_CLASS = {
  NORMAL: 'NORMAL',
  OUTLIER: 'OUTLIER',
  QUARANTINED: 'QUARANTINED',
  REJECTED: 'REJECTED',
};

/**
 * Gate efficiency observation: envelope when sufficient history, else 3σ fallback.
 */
export function gateEfficiencyObservation(efficiencyKmL, efficiencyHistory = [], config = ENVELOPE_GATING) {
  if (!Number.isFinite(Number(efficiencyKmL)) || Number(efficiencyKmL) <= 0) {
    return { isAnomalous: false, reason: null, gate: 'none' };
  }

  if (config?.enabled) {
    const envelope = computeOperatingEnvelope(efficiencyHistory, {
      method: config.method ?? 'median_mad',
      madMultiplier: config.madMultiplier ?? 3,
      minSamples: config.minSamples ?? 3,
      iqrMultiplier: config.iqrMultiplier ?? 1.5,
    });
    if (envelope.available) {
      const classification = classifyObservation(efficiencyKmL, envelope);
      if (classification === 'outlier') {
        return { isAnomalous: true, reason: 'envelope_outlier', gate: 'envelope', envelope };
      }
      return { isAnomalous: false, reason: null, gate: 'envelope', envelope };
    }
  }

  const sigma = detectEfficiencyAnomaly(efficiencyKmL, efficiencyHistory);
  return {
    isAnomalous: sigma.isAnomalous,
    reason: sigma.reason,
    gate: 'sigma',
    envelope: null,
  };
}

/**
 * Classify refuel interval evidence for learning decision.
 *
 * @param {{ validation: object, gateResult?: object }}
 */
export function classifyEvidence({ validation, gateResult = null }) {
  if (validation?.status === INTERVAL_STATUS.REJECTED) {
    return {
      evidenceClass: EVIDENCE_CLASS.REJECTED,
      shouldLearn: false,
      reason: validation.reason ?? 'rejected',
    };
  }

  if (!isLearnableInterval(validation)) {
    return {
      evidenceClass: EVIDENCE_CLASS.QUARANTINED,
      shouldLearn: false,
      reason: validation.reason ?? validation.status,
    };
  }

  if (gateResult?.isAnomalous) {
    return {
      evidenceClass: EVIDENCE_CLASS.OUTLIER,
      shouldLearn: false,
      reason: gateResult.reason ?? 'efficiency_outlier',
    };
  }

  return {
    evidenceClass: EVIDENCE_CLASS.NORMAL,
    shouldLearn: true,
    reason: null,
  };
}

export default { EVIDENCE_CLASS, gateEfficiencyObservation, classifyEvidence };
