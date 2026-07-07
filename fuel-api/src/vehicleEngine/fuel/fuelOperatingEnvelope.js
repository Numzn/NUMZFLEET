/**
 * Robust operating envelope for vehicle fuel efficiency (km/L).
 * All band parameters are injected — nothing hard-coded for production thresholds.
 */

function toPositiveNumbers(history) {
  return (history || [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function mad(values, med) {
  if (!values.length || med == null) return 0;
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations) ?? 0;
}

function quartile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] != null) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * @param {number[]} history — accepted efficiency samples (km/L)
 * @param {{
 *   method?: 'median_mad' | 'iqr',
 *   madMultiplier?: number,
 *   iqrMultiplier?: number,
 *   minSamples?: number,
 * }} params
 */
export function computeOperatingEnvelope(history, params = {}) {
  const method = params.method ?? 'median_mad';
  const minSamples = params.minSamples ?? 3;
  const values = toPositiveNumbers(history);

  if (values.length < minSamples) {
    return {
      center: null,
      lowerBound: null,
      upperBound: null,
      spread: null,
      method,
      sampleSize: values.length,
      available: false,
    };
  }

  if (method === 'iqr') {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quartile(sorted, 0.25);
    const q3 = quartile(sorted, 0.75);
    const iqr = q3 - q1;
    const multiplier = params.iqrMultiplier ?? 1.5;
    const center = median(values);
    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;
    return {
      center,
      lowerBound: Number(lowerBound.toFixed(4)),
      upperBound: Number(upperBound.toFixed(4)),
      spread: Number(iqr.toFixed(4)),
      method,
      sampleSize: values.length,
      available: true,
    };
  }

  const center = median(values);
  const spread = mad(values, center);
  const multiplier = params.madMultiplier ?? 3;
  const lowerBound = center - multiplier * spread;
  const upperBound = center + multiplier * spread;

  return {
    center: center != null ? Number(center.toFixed(4)) : null,
    lowerBound: Number(lowerBound.toFixed(4)),
    upperBound: Number(upperBound.toFixed(4)),
    spread: Number(spread.toFixed(4)),
    method: 'median_mad',
    sampleSize: values.length,
    available: true,
  };
}

/**
 * @param {number} value — candidate efficiency (km/L)
 * @param {ReturnType<typeof computeOperatingEnvelope>} envelope
 * @returns {'normal' | 'outlier' | 'no_envelope'}
 */
export function classifyObservation(value, envelope) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 'no_envelope';
  if (!envelope?.available || envelope.lowerBound == null || envelope.upperBound == null) {
    return 'no_envelope';
  }
  if (v < envelope.lowerBound || v > envelope.upperBound) {
    return 'outlier';
  }
  return 'normal';
}

export default { computeOperatingEnvelope, classifyObservation };
