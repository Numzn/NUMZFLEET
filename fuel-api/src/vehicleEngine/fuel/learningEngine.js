const HISTORY_CAP = 20;

function computeTrend(history) {
  if (!history || history.length < 4) return 'stable';
  const recent = history.slice(-3);
  const prior = history.slice(-6, -3);
  if (!prior.length) return 'stable';
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
  if (priorAvg <= 0) return 'stable';
  const pct = ((recentAvg - priorAvg) / priorAvg) * 100;
  if (pct > 5) return 'improving';
  if (pct < -5) return 'declining';
  return 'stable';
}

function adaptiveAlpha({ confidence, trend }) {
  if (confidence < 50) return 0.35;
  if (trend === 'declining') return 0.4;
  if (confidence > 80) return 0.15;
  return 0.3;
}

/**
 * EWMA learning update for vehicle fuel efficiency.
 */
export function applyLearningUpdate(state, intervalEfficiencyKmL, options = {}) {
  const efficiency = Number(intervalEfficiencyKmL);
  if (!Number.isFinite(efficiency) || efficiency <= 0) {
    return state;
  }

  const history = Array.isArray(state?.efficiencyHistory)
    ? [...state.efficiencyHistory]
    : [];

  const current = state?.currentEfficiency != null
    ? Number(state.currentEfficiency)
    : null;

  const confidence = state?.confidence != null ? Number(state.confidence) : 0;
  const trend = state?.trend ?? 'stable';
  const alpha = adaptiveAlpha({ confidence, trend });

  const nextEfficiency = current == null
    ? efficiency
    : (alpha * efficiency + (1 - alpha) * current);

  history.push(efficiency);
  const trimmed = history.slice(-HISTORY_CAP);
  const nextTrend = computeTrend(trimmed);

  const observations = (state?.totalObservations ?? 0) + 1;
  const distance = Number(options.distanceKm ?? 0);
  const totalDistanceKm = (Number(state?.totalDistanceKm ?? 0) + (Number.isFinite(distance) ? distance : 0));

  let nextConfidence = Math.min(100, Math.round(observations * 12));
  if (trimmed.length >= 3) nextConfidence = Math.min(100, nextConfidence + 10);
  if (nextTrend === 'stable') nextConfidence = Math.min(100, nextConfidence + 5);

  return {
    currentEfficiency: Number(nextEfficiency.toFixed(4)),
    confidence: nextConfidence,
    trend: nextTrend,
    totalObservations: observations,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    efficiencyHistory: trimmed,
    lastIntervalAt: options.eventAt ?? new Date(),
  };
}

export { adaptiveAlpha };
export default { applyLearningUpdate, adaptiveAlpha };
