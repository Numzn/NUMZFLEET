/**
 * Detect efficiency anomalies using 3σ from rolling history.
 */
export function detectEfficiencyAnomaly(efficiencyKmL, history = []) {
  const values = (history || [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);

  if (values.length < 3 || !Number.isFinite(Number(efficiencyKmL))) {
    return { isAnomalous: false, reason: null };
  }

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev <= 0) {
    return { isAnomalous: false, reason: null };
  }

  const z = Math.abs(Number(efficiencyKmL) - mean) / stdDev;
  if (z > 3) {
    return { isAnomalous: true, reason: 'efficiency_outlier' };
  }
  return { isAnomalous: false, reason: null };
}

export default { detectEfficiencyAnomaly };
